"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

type Toggle = "fitur_stok" | "fitur_produksi" | "fitur_pembelian";
const TOGGLES: { key: Toggle; label: string }[] = [
  { key: "fitur_stok", label: "Stok (bahan baku & penyesuaian stok)" },
  { key: "fitur_produksi", label: "Produksi" },
  { key: "fitur_pembelian", label: "Pembelian" },
];
const DEFAULTS = { fitur_stok: true, fitur_produksi: true, fitur_pembelian: false, staff_slots: 0 };

async function api(method: string, body: object, path = "/api/staff") {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}` },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? "Gagal");
  return j;
}

export function StaffSection() {
  const supabase = createClient();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const [s, a] = await Promise.all([
        supabase.from("staff_settings").select("fitur_stok, fitur_produksi, fitur_pembelian, staff_slots").maybeSingle(),
        supabase.from("staff_accounts").select("user_id, username, display_name").order("created_at"),
      ]);
      if (s.error) throw s.error;
      if (a.error) throw a.error;
      return { settings: s.data ?? DEFAULTS, accounts: a.data ?? [] };
    },
  });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const settings = data?.settings ?? DEFAULTS;
  const accounts = data?.accounts ?? [];
  const full = accounts.length >= settings.staff_slots;
  const refresh = () => qc.invalidateQueries({ queryKey: ["staff"] });

  async function setToggle(key: Toggle, value: boolean) {
    const { data: s } = await supabase.auth.getSession();
    const owner_id = s.session?.user.id;
    const { error } = await supabase
      .from("staff_settings")
      .upsert({ owner_id, [key]: value, updated_at: new Date().toISOString() }, { onConflict: "owner_id" });
    if (error) toast.error(error.message);
    refresh();
  }

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-[#FBF8F2] rounded-2xl border border-[#D9CCAF] shadow-sm p-6">
      <h2 className="text-base font-semibold text-[#2C1810] mb-1">Akun Karyawan</h2>
      <p className="text-sm text-[#7C6352] mb-5">
        Karyawan login pakai username. Mereka tidak bisa melihat HPP, laba, laporan, resep, pengeluaran, dan pengaturan.
        Slot terpakai {accounts.length}/{settings.staff_slots}.
      </p>

      <ul className="flex flex-col gap-2 mb-5">
        {accounts.map((a) => (
          <li key={a.user_id} className="flex items-center justify-between gap-2 text-sm">
            <span>
              <b>{a.username}</b> {a.display_name !== a.username && <span className="text-[#7C6352]">({a.display_name})</span>}
            </span>
            <span className="flex gap-1">
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  const pw = prompt(`Password baru untuk ${a.username} (min 8 karakter)`);
                  if (pw) run(() => api("PATCH", { user_id: a.user_id, password: pw }), "Password diganti");
                }}
              >
                Ganti password
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Hapus ${a.username}`}
                disabled={busy}
                onClick={() => {
                  if (confirm(`Hapus akun ${a.username}? Riwayat penjualannya tetap ada.`))
                    run(() => api("DELETE", { user_id: a.user_id }), "Akun dihapus");
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </span>
          </li>
        ))}
      </ul>

      <Button
        variant="secondary"
        size="sm"
        className="mb-5"
        loading={busy}
        onClick={() =>
          run(async () => {
            const { url } = await api("POST", {}, "/api/staff/slot");
            window.location.href = url;
          }, "Mengarahkan ke pembayaran…")
        }
      >
        Tambah 1 slot karyawan — Rp50.000
      </Button>

      {full ? (
        <p className="text-sm text-[#7C6352] mb-5">Slot penuh. Tambah slot untuk menambah karyawan.</p>
      ) : (
        <form
          className="flex flex-col gap-3 mb-5"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api("POST", { username, password });
              setUsername("");
              setPassword("");
            }, "Karyawan ditambahkan");
          }}
        >
          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            pattern="[a-z0-9_]{3,20}"
            title="3-20 karakter: huruf kecil, angka, _"
            autoComplete="off"
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            autoComplete="new-password"
            required
          />
          <Button type="submit" loading={busy} className="self-start">
            Tambah karyawan
          </Button>
        </form>
      )}

      <h3 className="text-sm font-semibold text-[#2C1810] mb-2">Fitur yang boleh dipakai karyawan</h3>
      <p className="text-xs text-[#7C6352] mb-3">Berlaku untuk semua karyawan. Penjualan selalu aktif.</p>
      {TOGGLES.map((t) => (
        <label key={t.key} className="flex items-center gap-2 text-sm py-1">
          <input
            type="checkbox"
            checked={settings[t.key]}
            onChange={(e) => setToggle(t.key, e.target.checked)}
          />
          {t.label}
        </label>
      ))}
    </div>
  );
}
