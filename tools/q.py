#!/usr/bin/env python3
"""Jalankan SQL ke DB prod via Supabase Management API. Pakai: tools/q.py "sql" | tools/q.py -f file.sql"""
import json, sys, os, urllib.request
REF = "tqhfnaerzttcfceoygxw"
tok = open(os.path.expanduser("~/.config/supabase/dapur-access-token")).read().strip()
sql = open(sys.argv[2]).read() if sys.argv[1] == "-f" else sys.argv[1]
req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{REF}/database/query",
    data=json.dumps({"query": sql}).encode(), method="POST",
    headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json", "User-Agent": "q.py"})
try:
    out = json.load(urllib.request.urlopen(req))
except urllib.error.HTTPError as e:
    sys.exit(f"HTTP {e.code}: {e.read().decode()}")
for r in out if isinstance(out, list) else [out]:
    print(" | ".join(str(v) for v in r.values()) if isinstance(r, dict) else r)
