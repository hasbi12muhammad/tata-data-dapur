# Rencana Dasar: Multi-Tenant Base App + Paket Fitur (mulai dari Modul Kasir)

> Dokumen ini adalah **basis untuk dijalankan di Claude Code**. Saat siap membangun,
> buka Claude Code di repo ini dan beri instruksi: *"Ikuti docs/PLAN-MULTI-TENANT-KASIR.md,
> mulai dari bagian 'Implementasi pertama: Modul Kasir'."* Hasil diskusi perencanaan, bukan
> kode jadi.

## Context (kenapa ini dikerjakan)

App `tata-data-dapur` (Next.js 15 App Router + Supabase + Cloudflare Pages) — aplikasi
manajemen HPP/inventori/penjualan untuk UMKM F&B — diubah menjadi **base app** yang dijual
sebagai **paket fitur bertingkat**. Tiap klien:
- punya **deployment sendiri** (Cloudflare Pages project) + **domain sendiri**,
- punya **database Supabase sendiri** (isolasi data total),
- mengaktifkan fitur sesuai **paket** yang dibeli,
- bisa minta **fitur custom** tanpa membuat codebase bercabang.

**Aturan inti:**
> Semua klien build dari **satu repo yang sama**. Perbedaan antar klien HANYA di **env var**
> (kredensial Supabase + daftar fitur aktif + branding), TIDAK PERNAH di kode inti. Karena itu
> push update ke base = **semua klien auto-update** (Cloudflare auto-deploy on git push).

---

## Sudah dibangun (fondasi — branch `claude/multi-tenant-feature-packages-fn2eg7`)

- `src/lib/features/registry.ts` — daftar fitur; `core: true` (paket dasar) vs `core: false`
  (add-on). Sudah ada entry `kasir`.
- `src/lib/features/entitlements.ts` — `isFeatureEnabled()`, `isPathAllowed()`; baca env
  `NEXT_PUBLIC_ENABLED_FEATURES` / `NEXT_PUBLIC_DISABLED_FEATURES`.
- `src/lib/tenant/config.ts` — `getTenantConfig()` (nama/plan/fitur dari env).
- `Sidebar.tsx` & `middleware.ts` — nav & route ter-gating otomatis; hack lama
  `RECIPE_HIDDEN_UID` sudah diganti mekanisme env.
- `.env.example`, `docs/ARCHITECTURE.md`, `docs/PROVISIONING.md`.

---

## Katalog paket (bertingkat / cumulative) — DIKUNCI

Kasir adalah **fitur**, bukan paket. Tier lebih tinggi = semua fitur tier bawahnya + tambahan.

| Paket | Isi (cumulative) | Status |
|---|---|---|
| **Base** (bawaan) | HPP, bahan baku, pembelian, pengeluaran, produk, produksi, penjualan, laporan | ✅ ada |
| **A — Starter** | Base + **Kasir** (+cetak struk) + **Branding** (white-label + custom domain) | 🔜 pertama |
| **B — Growth** | Semua A + **Notifikasi WhatsApp** + **Alert stok menipis** | nanti |
| **C — Pro** | Semua B + **Pelanggan** (member + poin loyalti/diskon) | nanti |
| **D — Premium** | Semua C + **Toko Online** (katalog publik + pesan online) | nanti |

Kesulitan: Kasir & Branding = mudah; WhatsApp, Pelanggan, Alert stok = menengah; Toko Online =
menantang. Pemetaan paket→fitur→harga disimpan di `docs/PACKAGES.md` (dibuat saat implementasi).

---

## Cara fitur custom (1 klien) — tanpa codebase bercabang

Tiga lapis (urut dari paling dianjurkan), supaya "satu codebase + auto-update" tetap utuh:

1. **Cara 1 — modul ber-saklar khusus klien (repo sama).** Kode custom = modul terisolasi di
   `src/features/<nama>/`, diaktifkan HANYA untuk klien itu lewat flag env. Klien lain: mati
   total. Update base tetap nyampe. Dipakai bila butuh tampilan/tombol khusus.
2. **Cara 3 — "alat" di Supabase klien.** Automasi/integrasi server-side (mis. kirim WA saat
   `orders.status='siap'`) = **Edge Function + Database Webhook** di project Supabase klien.
   Frontend tak disentuh. Dipakai untuk automasi tanpa UI.
3. **Cara 2 — fork penuh.** Last resort; klien lepas dari auto-update. **Dihindari.**

Contoh "WA pesanan siap" → **Cara 3**, codebase tak berubah.

### 4 kekhawatiran & jawabannya
- **Codebase berantakan** → tiap fitur = modul terpisah `src/features/<id>/`; kode inti hanya
  memanggil lewat registry; **dilarang `if (klien == X)` di kode inti**.
- **Keamanan kode yang dimatikan** → flag = kontrol UX lunak; **tembok keras = database
  per-klien**. Rahasia/API key selalu di backend (Supabase klien), tak pernah di frontend.
- **Custom butuh tabel beda** → migrasi khusus dijalankan HANYA ke DB klien itu di
  `supabase/custom/<klien>/`. DB terpisah = nol tabrakan.
- **Operasional & harga** → 3 daftar: price book (`docs/PACKAGES.md`), daftar klien (roster),
  playbook onboarding (`docs/PROVISIONING.md`). 5–20 klien manual OK; ratusan → otomasi API.

---

## Pola modul fitur (konvensi)

- Logika fitur di `src/features/<id>/` (components, hooks, util).
- Route tipis `src/app/<route>/page.tsx`: `"use client"` + `export const dynamic = "force-dynamic"`
  + bungkus `AppLayout`, hanya meng-import modul.
- Daftarkan di `src/lib/features/registry.ts`; nav di `Sidebar.tsx` dengan `feature: <id>`.
- Gating otomatis via `isFeatureEnabled` (sidebar) & `isPathAllowed` (middleware).

---

## Implementasi pertama: Modul Kasir (Paket A)

Tujuan v1: tampilan kasir cepat untuk transaksi di tempat, **reuse** alur penjualan & struk
yang sudah ada. QRIS/shift/multi-kasir = tier lebih tinggi (di luar v1).

### Reuse (jangan tulis ulang)
- **Pencatatan penjualan:** `useCreateSale` (`src/hooks/useSales.ts`) — sudah memanggil RPC
  `deduct_sub_recipe_stock`, `adjust_item_stock`, dan alur "Produksi & Jual" via `produce_recipe`
  saat stok kurang. Kasir kirim payload `SalePayloadItem` yang sama.
- **Produk:** `useRecipes()` — filter `is_ingredient=false`, pakai `selling_price` & `hpp`.
- **Struk:** `buildThermalHtml`/`buildStrokHtml` saat ini di dalam `src/app/sales/page.tsx`
  (~baris 614–656). **Refactor** keluar ke `src/features/_shared/receipt.ts` agar Kasir &
  Penjualan sama-sama pakai. Pakai `formatCurrency` (`src/lib/utils.ts`).
- **UI:** `Button`, `Card`, `Modal`, `Input`, `EmptyState` (`src/components/ui/`). Tema cokelat/
  krem (`#7C563D`, `#A05035`, `#E9DFC6`, `#F2EBD9`, `#2C1810`).

### Buat baru
- `src/features/kasir/` — `ProductGrid` (grid + cari), `Cart` (qty +/-), `PaymentModal`
  (uang diterima → hitung kembalian), `KasirPage` (komposisi).
- `src/app/kasir/page.tsx` — route tipis (client) render `KasirPage` di `AppLayout`.
- (opsional) hook `useKasirCheckout` membungkus `useCreateSale` (snapshot struk + reset keranjang).

### Database (opsional, info pembayaran)
`sales` belum punya kolom pembayaran. Tambah migrasi base **nullable** (aman semua klien):
`supabase/migrations/0XX_sale_payment.sql` → `payment_method text`, `paid_amount numeric(15,2)`,
`change_amount numeric(15,2)`. Jika v1 tak mau sentuh DB, kembalian dihitung client-side & kolom
ini ditunda.

### Aktivasi paket
Klien Paket A: env deployment `NEXT_PUBLIC_ENABLED_FEATURES=kasir` (+ branding env). Tanpa ini,
menu/route Kasir tersembunyi & terblokir otomatis.

---

## Dokumen yang ditulis ke repo saat implementasi
- `docs/PACKAGES.md` — price book paket A/B/C/D → fitur → (kolom harga diisi user).
- Update `docs/ARCHITECTURE.md` — bagian "fitur custom (Cara 1/2/3)" + 4 kekhawatiran.
- Update `docs/PROVISIONING.md` — contoh onboarding 1 klien + custom (Cara 3) end-to-end.

---

## Verifikasi
1. `npm install && npm run build` lolos.
2. `npm run dev` + `.env.local` `NEXT_PUBLIC_ENABLED_FEATURES=kasir` → menu Kasir muncul;
   tanpa flag → menu hilang & `/kasir` redirect ke `/dashboard`.
3. Di `/kasir`: tambah produk → bayar → kembalian benar → transaksi tercatat di Penjualan &
   stok berkurang.
4. Alur "Produksi & Jual" saat stok kurang tetap jalan.
5. Cetak struk dari kasir = sama dengan struk di Penjualan (modul receipt ter-share).

---

## Urutan kerja
1. Refactor receipt builder ke modul share + buat struktur `src/features/`.
2. Bangun Modul Kasir v1 + route + `docs/PACKAGES.md`.
3. (opsional) migrasi kolom pembayaran.
4. Tier berikutnya: Branding → WhatsApp/Alert stok → Pelanggan → Toko Online.
