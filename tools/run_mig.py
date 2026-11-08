#!/usr/bin/env python3
"""Jalankan file migrasi SQL statement-per-statement via Management API.
Pemakaian: python3 tools/run_mig.py <file.sql>
Token: ~/.config/supabase/dapur-access-token (chmod 600)
"""
import json, sys, urllib.request

PROJ = "tqhfnaerzttcfceoygxw"
TOKEN_FILE = "/home/hasbi/.config/supabase/dapur-access-token"

token = open(TOKEN_FILE).read().strip()
sql = open(sys.argv[1]).read()

# --- split statements: strip -- comments, hormati blok $$ ---
stmts, cur, in_d, i = [], [], False, 0
while i < len(sql):
    if not in_d and sql.startswith("--", i):
        j = sql.find("\n", i)
        if j == -1:
            break
        i = j
        continue
    if sql.startswith("$$", i):
        in_d = not in_d
        cur.append("$$")
        i += 2
        continue
    c = sql[i]
    if not in_d and c == ";":
        s = "".join(cur).strip()
        if s:
            stmts.append(s)
        cur = []
        i += 1
        continue
    cur.append(c)
    i += 1
tail = "".join(cur).strip()
if tail:
    stmts.append(tail)

print(f"{len(stmts)} statements")
for n, st in enumerate(stmts, 1):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJ}/database/query",
        data=json.dumps({"query": st}).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "run_mig.py",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read().decode()
    except urllib.error.HTTPError as e:
        detail = e.read().decode()[:500]
        print(f"FAIL {n}: {st[:100]!r} -> HTTP {e.code}: {detail}")
        sys.exit(1)
    out = body.strip()
    print(f"ok {n}: {out[:120] if out and out != '[]' else '-'}")
print("DONE")
