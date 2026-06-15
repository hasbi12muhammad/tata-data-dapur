# Playbook: Onboarding Klien Baru

Langkah membuat satu deployment baru untuk satu klien. Saat ini manual; nanti
bisa diotomasi (lihat bagian akhir). Estimasi ~15–20 menit per klien.

## Prasyarat
- Akses ke akun Supabase (boleh pakai email klien, atau email baru khusus klien).
- Akses ke Cloudflare (Pages) untuk repo base app.
- Domain / subdomain untuk klien.

## 1. Buat database klien (Supabase project)
1. Buat Supabase **project baru** untuk klien ini (1 klien = 1 project = DB terpisah).
2. Jalankan semua migrasi di `supabase/migrations/` (urut) ke project tsb.
   - Via Supabase CLI: `supabase db push` dengan project ref klien, **atau**
   - Tempel isi tiap file migrasi di SQL Editor secara berurutan.
3. (Opsional) Buat user login awal untuk klien lewat Authentication → Users.
4. Catat **Project URL** dan **anon key** (Settings → API).

## 2. Buat deployment klien (Cloudflare Pages)
1. Buat Cloudflare Pages **project baru** yang terhubung ke repo base app,
   branch produksi yang sama dengan klien lain (mis. `main`).
   - Build command: `npm run cf-build`
   - Output dir: `.vercel/output/static` (lihat `wrangler.toml`)
2. Set **Environment Variables** (lihat `.env.example`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=<url project klien>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key klien>
   NEXT_PUBLIC_TENANT_NAME=<nama bisnis klien>
   NEXT_PUBLIC_TENANT_PLAN=<base | kasir | ...>
   NEXT_PUBLIC_ENABLED_FEATURES=<add-on yang dibeli, mis. kasir>
   NEXT_PUBLIC_DISABLED_FEATURES=<core yang disembunyikan, biasanya kosong>
   ```
3. Deploy.

## 3. Pasang domain
- **Subdomain otomatis (default):** arahkan `klien.namaapp.com` ke Pages project
  (wildcard CNAME `*.namaapp.com` → pages.dev, lalu tambahkan custom domain di
  project).
- **Custom domain (paket premium, menyusul):** tambahkan domain klien di
  Cloudflare for SaaS / custom hostname, verifikasi DNS, lalu pasang di project.

## 4. Verifikasi
- Buka domain klien → login → cek hanya menu sesuai paket yang muncul.
- Cek akses langsung ke route fitur yang TIDAK dibeli → harus redirect ke
  /dashboard (gating middleware bekerja).

## Update base app (semua klien sekaligus)
Push perubahan ke branch produksi → Cloudflare auto-deploy ulang **semua**
deployment klien. Tidak perlu sentuh tiap klien. Jika perubahan butuh migrasi
DB, jalankan migrasi tsb ke database tiap klien (lihat langkah 1.2).

## Mengubah paket klien (upgrade/downgrade)
 Cukup ubah `NEXT_PUBLIC_ENABLED_FEATURES` di env Cloudflare klien tsb lalu
re-deploy. Jika fitur baru butuh tabel DB, jalankan migrasinya ke DB klien dulu.

## Otomasi (rencana ke depan)
- Buat DB klien via **Supabase Management API**.
- Buat Pages project + set env via **Cloudflare API**.
- Skrip `scripts/provision-client.ts` yang menerima nama klien + daftar paket,
  lalu menjalankan kedua hal di atas + menjalankan migrasi otomatis.
