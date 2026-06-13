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

---

# Integrasi dengan TataData Admin (kontrol aktivasi fitur per klien)

> Ditambahkan 2026-06-13. Keputusan: **fitur dibaca runtime dari Supabase tiap klien**
> (bukan rebuild), **env = nilai default cadangan**. Admin nulis ke DB klien pakai
> `serviceKey` yang sudah dipunya. Hasil diskusi perencanaan, bukan kode jadi.

## Yang sudah ada di TataData Admin (`/home/hasbi/Proyek/tata-data-admin`)

App terpisah: **React (Vite) + Cloudflare Worker (Hono)**. Sudah jalan:
- **Roster klien** via env worker: `PROJ_<n>_NAME / _URL / _SERVICE_KEY / _APP_URL / _CLEANUP_TABLES`
  (`worker/projects.ts`). Tiap klien = satu Supabase project; admin pegang `serviceKey`-nya.
- **User per klien** (`worker/supabase-admin.ts`): list/create/update/delete/ban.
- **Subscription per user** (`worker/subscription.ts`): pause / resume / extend / expired,
  disimpan di **`user.metadata`** Supabase klien (`subscription_ends_at`, `subscription_paused_at`,
  `subscription_notified_14d`) + email reminder (`worker/email.ts`).
- **Analytics** + **cleanup data** per project.
- Auth admin: password + JWT (`worker/auth.ts`).

**Belum ada:** pengaturan **fitur/paket** per klien. Itu yang ditambah di bawah. Karena admin
**sudah rutin nulis ke DB klien via serviceKey** (untuk subscription), fitur "nebeng" jalur sama
— tanpa mekanisme/infra baru.

## Model data — di Supabase TIAP klien

Tabel singleton baru (satu baris per deployment klien) di migrasi base (jadi semua klien punya):

```sql
-- supabase/migrations/0XX_tenant_settings.sql
create table if not exists tenant_settings (
  id              int primary key default 1 check (id = 1),  -- paksa satu baris
  plan            text,                                      -- 'A' | 'B' | ... (informasi)
  enabled_features text[] not null default '{}',             -- add-on yang nyala, mis. {'kasir'}
  disabled_features text[] not null default '{}',            -- core yang dimatikan
  updated_at      timestamptz not null default now()
);
insert into tenant_settings (id) values (1) on conflict do nothing;

alter table tenant_settings enable row level security;
-- Klien BOLEH baca (buat gating UI). HANYA service role (admin) yang boleh tulis.
create policy tenant_settings_read on tenant_settings for select to authenticated using (true);
-- (tanpa policy insert/update untuk authenticated → tulis hanya lewat service role)
```

Kenapa tabel singleton, bukan `user.metadata`: fitur itu **se-deployment** (berlaku buat seluruh
klien), bukan per-user. Subscription tetap di metadata (per akun pemilik) — dua urusan beda,
jangan dicampur.

## Perubahan di Base App (`TataData-Dapur`)

`entitlements.ts` sekarang **build-time + cached dari env** (`entitlements.ts:36`). Ubah jadi
**resolver runtime** yang gabung DB + env:

1. **Sumber utama:** baca `tenant_settings` (id=1) dari Supabase klien.
2. **Cadangan:** kalau DB kosong/gagal dibaca → pakai `NEXT_PUBLIC_ENABLED_FEATURES` /
   `NEXT_PUBLIC_DISABLED_FEATURES` (perilaku lama). **App tak boleh rusak** kalau DB unreachable.
3. Resolusi tetap lewat `registry` (`core` vs add-on) seperti sekarang.

Implikasi teknis:
- `getEnabledFeatureIds()` jadi **async** (baca DB). Sediakan `getEnabledFeatureIdsSync()` (env-only)
  untuk fallback awal render bila perlu, plus cache pendek per-request.
- **`middleware.ts`** sudah query DB klien (version gating `user_profiles`) → tambah baca
  `tenant_settings` di sini sekaligus, satu round-trip. Hasilnya boleh ditempel ke response
  header / cookie ringan supaya client tak query ulang.
- **`Sidebar.tsx`** & gating route ikut hasil resolver runtime (bukan env statis).
- Tambah endpoint publik kecil **`/api/features`** (baca dari `registry`) supaya admin bisa
  ambil katalog fitur (id + label + core) tanpa duplikasi manual. (Opsional; v1 boleh hardcode
  katalog di admin.)

## Perubahan di TataData Admin

**Worker (`worker/`):**
- Endpoint baru, pola sama seperti subscription:
  - `GET  /api/projects/:projectId/features` → baca `tenant_settings` dari Supabase klien.
  - `PUT  /api/projects/:projectId/features` → tulis `enabled_features` / `disabled_features`
    (service role). Validasi id fitur terhadap katalog.
- Helper di `worker/supabase-admin.ts` untuk `select/upsert tenant_settings` via serviceKey.
- (Opsional) ambil katalog dari `PROJ_<n>_APP_URL` + `/api/features`; fallback katalog hardcode.

**UI (`src/pages/`):**
- Halaman per klien: **daftar fitur dengan toggle** (checkbox dari katalog registry), tampilkan
  paket aktif + status subscription. Simpan → panggil `PUT .../features`.
- Tampilkan **peringatan kopling DB**: kalau fitur butuh migrasi (mis. Kasir → kolom pembayaran),
  kasih catatan "pastikan migrasi klien sudah jalan" sebelum/saat mengaktifkan.

## Alur end-to-end (toggle Kasir untuk 1 klien)

```
Admin UI: centang "Kasir" untuk Klien X
        ↓  PUT /api/projects/X/features
Worker: pakai serviceKey Klien X → upsert tenant_settings.enabled_features = {'kasir'}
        ↓
App Klien X (next request): middleware baca tenant_settings → 'kasir' nyala
        ↓
Sidebar munculin menu Kasir, /kasir lolos gating  — TANPA rebuild
```

## Keamanan & integritas
- Flag fitur = **kontrol UX lunak** (tetap NEXT_PUBLIC-friendly). **Tembok keras = DB per-klien
  + RLS**: walau seseorang maksa flag nyala, tanpa data/izin di DB klien fitur tak berfungsi.
- `tenant_settings`: authenticated boleh **baca**, tulis **hanya service role** (admin).
- **Kopling fitur ↔ migrasi:** mengaktifkan fitur yang butuh skema (Kasir → kolom pembayaran)
  HARUS dibarengi migrasi ke DB klien itu. v1: checklist manual di admin. Nanti: admin trigger
  migrasi `supabase/custom/<klien>/` otomatis.
- **Subscription vs fitur = dua lapis berbeda:** subscription (per akun) ngatur boleh login/akses
  (expired → ban/blokir); fitur (se-deployment) ngatur modul mana yang tampil. Pertimbangkan:
  saat subscription `expired/paused`, gating bisa otomatis matiin add-on (kebijakan menyusul).

## Urutan kerja integrasi admin
1. Base app: migrasi `tenant_settings` + ubah `entitlements.ts` jadi resolver runtime (DB→env fallback)
   + baca di `middleware.ts` + endpoint `/api/features`.
2. Admin worker: endpoint `GET/PUT features` + helper `tenant_settings` via serviceKey.
3. Admin UI: halaman toggle fitur per klien (+ peringatan kopling migrasi).
4. Uji end-to-end: toggle Kasir di admin → muncul di app klien tanpa rebuild; matikan → hilang.
5. (Nanti) Lifecycle: auto-gate add-on saat subscription expired; otomasi migrasi per klien.

## Item terbuka (dibahas lagi)
- Kebijakan persis saat subscription expired/paused terhadap fitur add-on.
- Katalog fitur: endpoint `/api/features` vs hardcode di admin (v1).
- Otomasi migrasi per-klien saat mengaktifkan fitur ber-skema.
