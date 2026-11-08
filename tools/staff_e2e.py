#!/usr/bin/env python3
"""E2E staff: login, decode JWT, cek akses tabel. Pakai: python3 tools/staff_e2e.py <email> <password>"""
import base64, json, sys, urllib.request, urllib.error, pathlib

env = dict(l.split("=", 1) for l in pathlib.Path(".env.local").read_text().splitlines() if "=" in l and not l.startswith("#"))
URL, ANON = env["NEXT_PUBLIC_SUPABASE_URL"].strip(), env["NEXT_PUBLIC_SUPABASE_ANON_KEY"].strip()

def req(method, path, data=None, token=None):
    h = {"apikey": ANON, "Content-Type": "application/json", "User-Agent": "staff-e2e"}
    if token: h["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(URL + path, json.dumps(data).encode() if data is not None else None, h, method=method)
    try:
        with urllib.request.urlopen(r) as x: return x.status, x.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()

s, b = req("POST", "/auth/v1/token?grant_type=password", {"email": sys.argv[1], "password": sys.argv[2]})
if s != 200: sys.exit(f"LOGIN FAIL {s}: {b[:200]}")
tok = json.loads(b)["access_token"]
p = tok.split(".")[1]; c = json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4)))
print("jwt role =", c.get("role"), "| owner_id =", c.get("owner_id"))

checks = [  # (label, path, expect: ok|deny)
    ("items basic", "/rest/v1/items?select=id,name&limit=1", "ok"),
    ("items avg_price", "/rest/v1/items?select=avg_price&limit=1", "deny"),
    ("recipes basic", "/rest/v1/recipes?select=id,name&limit=1", "ok"),
    ("recipes star", "/rest/v1/recipes?select=*&limit=1", "deny"),
    ("sales basic", "/rest/v1/sales?select=id&limit=1", "ok"),
    ("sale_items hpp", "/rest/v1/sale_items?select=hpp_at_sale&limit=1", "deny"),
    ("purchases", "/rest/v1/purchases?select=id&limit=1", "ok"),
    ("staff_settings", "/rest/v1/staff_settings?select=*", "ok"),
    ("expenses", "/rest/v1/expenses?select=id&limit=1", "deny"),
    ("user_profiles", "/rest/v1/user_profiles?select=*", "deny"),
    ("productions cost", "/rest/v1/productions?select=total_cost&limit=1", "deny"),
    ("purchases harga", "/rest/v1/purchases?select=total_price&limit=1", "deny"),
]
bad = 0
Z = "00000000-0000-0000-0000-000000000000"
rpcs = [  # (label, fn, args, substring error yang diharapkan)
    ("rpc pembelian OFF", "record_purchase", {"p_user_id": c.get("owner_id"), "p_item_id": Z, "p_quantity": 1,
        "p_total_price": 1, "p_price_per_unit": 1}, "Fitur pembelian tidak aktif"),
    ("rpc produksi ON", "produce_recipe", {"p_user_id": c.get("owner_id"), "p_recipe_id": Z, "p_batches": 1,
        "p_total_cost": 0}, "Recipe not found"),
    ("rpc tenant lain", "adjust_item_stock", {"p_user_id": Z, "p_item_id": Z, "p_delta": 1}, "Unauthorized"),
    ("rpc hook ditolak", "staff_hook_lookup", {"p_uid": Z}, "permission denied"),
]
for label, fn, args, want in rpcs:
    s, b = req("POST", f"/rest/v1/rpc/{fn}", args, token=tok)
    flag = "PASS" if want in b else "FAIL"; bad += flag == "FAIL"
    print(f"{flag} {label}: {s} {b[:90]}")
for label, path, exp in checks:
    s, b = req("GET", path, token=tok)
    got = "ok" if s == 200 else "deny"
    flag = "PASS" if got == exp else "FAIL"; bad += flag == "FAIL"
    print(f"{flag} {label}: {s} {b[:90]}")
print("RESULT:", "ALL PASS" if not bad else f"{bad} FAIL")
