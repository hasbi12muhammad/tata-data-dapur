# Tata Data Dapur — Dokumen Konteks untuk Brainstorm

Dokumen ini menjelaskan aplikasi secara menyeluruh: tech stack, arsitektur,
model data, tiap fitur beserta fungsi, flow yang mungkin terjadi, dan edge case
yang sering muncul. Tujuannya sebagai bahan brainstorm (misalnya untuk diunggah
ke Claude web). Bahasa campur: prosa Indonesia, istilah teknis Inggris.

---

## 1. Ringkasan Produk

**Tata Data Dapur** (kode internal: `tata-data-dapur`, sebelumnya "Costify")
adalah aplikasi web untuk **manajemen biaya & operasional dapur/UMKM F&B**
(katering, kue, frozen food, warung). Inti nilainya: menghitung **HPP (Harga
Pokok Produksi)** secara akurat dengan **weighted average price** bahan baku,
lalu melacak stok, produksi, penjualan, pengeluaran, dan laba.

Target user: pemilik usaha makanan kecil-menengah yang ingin tahu **berapa
modal sebenarnya per produk** dan **berapa untung bersihnya**, tanpa ribet
akuntansi.

Model bisnis: **multi-tenant SaaS** — satu codebase melayani banyak klien,
tiap klien punya database & deployment sendiri, membeli paket fitur berbeda.

---

## 2. Tech Stack

| Lapis | Teknologi |
|---|---|
| Framework | **Next.js 15.3.3** (App Router, React 19) — catatan: versi ini punya breaking changes; selalu cek `node_modules/next/dist/docs/` |
| Bahasa | **TypeScript 5** |
| Styling | **Tailwind CSS v4** (`@tailwindcss/postcss`) |
| State/Data fetching | **TanStack React Query v5** (semua server state via `useQuery`/`useMutation`, invalidasi cache manual) |
| Backend / DB | **Supabase** (PostgreSQL + Auth + RLS), diakses via `@supabase/ssr` & `@supabase/supabase-js` |
| Auth | Supabase Auth (email+password), session lewat cookie, dijaga `middleware.ts` |
| Logika bisnis kritis | **PostgreSQL RPC** (`SECURITY DEFINER` functions) untuk operasi atomik stok & weighted average |
| Charts | **Recharts v3** (laporan) |
| Export/Import | **xlsx** (Excel), **html-to-image** (export laporan jadi gambar) |
| Ikon | **lucide-react** |
| Notifikasi | **react-hot-toast** |
| Util tanggal | **date-fns v4** |
| Deployment | **Cloudflare Pages** via `@cloudflare/next-on-pages` (`npm run cf-build`), config di `wrangler.toml` |
| PWA | Service worker (`public/sw.js`) + `manifest.json`, ada halaman `/offline` |

### Struktur folder penting
```
src/
  app/                  # halaman (App Router), tiap fitur 1 folder page.tsx
    dashboard, items, purchases, expenses, recipes,
    produksi, sales, reports, settings, login, kasir(add-on)
  components/ui/        # Button, Card, Modal, Input, StatCard, ImportExcelModal, EmptyState
  components/layout/    # AppLayout, Sidebar
  hooks/                # useItems, usePurchases, useRecipes, useSales, useExpenses, useAuth, useDailyData
  lib/
    supabase/           # client.ts (browser), server.ts (SSR)
    features/           # registry.ts + entitlements.ts (sistem paket fitur)
    tenant/config.ts    # branding per-klien dari env
    utils.ts            # cn, formatCurrency, formatNumber, calcProfitMargin
  types/index.ts        # semua tipe domain
  middleware.ts         # auth guard + feature-route gating
supabase/migrations/    # skema + RPC (dijalankan ke tiap DB klien)
supabase/seeds/         # data dummy
docs/                   # ARCHITECTURE, PLAN-MULTI-TENANT-KASIR, PROVISIONING
```

---

## 3. Arsitektur Multi-Tenant (Base App + Paket Fitur)

**Prinsip inti:** *Satu codebase untuk semua klien. Perbedaan antar klien HANYA
di env var, TIDAK PERNAH di cabang kode.* Ini yang membuat "push ke base →
semua klien auto-update" berhasil (Cloudflare auto-deploy ulang tiap deployment).

### Tiga lapis pembeda per klien
| Lapis | Mekanisme | Env var |
|---|---|---|
| Database | 1 klien = 1 Supabase project (DB terpisah) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Fitur/paket | Feature flag dibaca dari registry entitlement | `NEXT_PUBLIC_ENABLED_FEATURES`, `NEXT_PUBLIC_DISABLED_FEATURES` |
| Branding | Nama bisnis & label plan | `NEXT_PUBLIC_TENANT_NAME`, `NEXT_PUBLIC_TENANT_PLAN` |

### Sistem entitlement
- `src/lib/features/registry.ts` — **single source of truth** untuk semua fitur.
  Tiap fitur punya `id`, `label`, `routes`, `core` (true=paket dasar, nyala
  default; false=add-on, mati default), dan `package`.
- `src/lib/features/entitlements.ts`:
  - `isFeatureEnabled(id)` — dipakai Sidebar untuk sembunyikan menu.
  - `isPathAllowed(path)` — dipakai `middleware.ts` untuk blokir route fitur
    yang tidak dibeli (redirect ke `/dashboard`).
  - Hasil di-cache per request agar tidak re-parse env tiap call.
- Logika: core feature ON kecuali ada di `DISABLED_FEATURES`; add-on OFF kecuali
  ada di `ENABLED_FEATURES`.

### Paket yang dijual
| Paket | Fitur | Aktivasi |
|---|---|---|
| **Base** | dashboard, items, purchases, expenses, recipes, produksi, sales, reports | default |
| **Kasir** | + Kasir/POS (`/kasir`) | `NEXT_PUBLIC_ENABLED_FEATURES=kasir` |

> **Catatan keamanan:** gating env adalah kontrol **UX**, bukan batas keamanan
> keras. Isolasi data dijamin di level infrastruktur (DB terpisah + RLS Supabase
> per `user_id`). Gating route hanya mencegah menu/halaman muncul.

### Provisioning klien baru (~15–20 menit, manual)
1. Buat Supabase project baru → jalankan semua migrasi berurutan → catat URL+anon key.
2. Buat Cloudflare Pages project (connect ke repo base, branch sama) → set env var → deploy.
3. Pasang domain/subdomain.
4. Verifikasi: login, cek hanya menu paket yang muncul, cek route tak-dibeli redirect.

Upgrade/downgrade paket = ubah `NEXT_PUBLIC_ENABLED_FEATURES` lalu re-deploy
(jalankan migrasi DB dulu jika fitur butuh tabel baru). Rencana ke depan:
otomasi via Supabase Management API + Cloudflare API + skrip `provision-client.ts`.

---

## 4. Model Data (PostgreSQL)

Semua tabel punya `user_id` + RLS policy `auth.uid() = user_id` (isolasi per
user di dalam satu DB klien). Kolom uang `numeric(15,2/4)`.

### Entitas utama
- **items** (bahan baku): `name`, `unit` (gr/ml/pcs/kg/liter), `avg_price`
  (weighted average, dihitung sistem), `prev_avg_price` (avg sebelum pembelian
  terakhir, untuk bandingkan tren HPP), `stock`, `is_addon`, `selling_price`.
- **packaging_types**: master jenis kemasan (untuk konversi pembelian per-kemasan).
- **purchases** (pembelian): `item_id`, `quantity`, `total_price`,
  `price_per_unit` (kolom **generated**, jangan di-insert eksplisit — sumber
  beberapa bug historis), opsional `pkg_type_id`/`pkg_qty`/`size_per_pkg` untuk
  pembelian berbasis kemasan, `created_at` (bisa backdate).
- **recipes** (produk / sub-resep): `name`, `is_ingredient` (true=bahan setengah
  jadi/sub-recipe yang punya stok sendiri), `is_addon`, `unit`, `stock`,
  `avg_price`, `batch_yield` (jumlah unit per batch), `waste_pct` (% susut),
  `hpp_baseline`, `selling_price`. HPP **tidak disimpan** — dihitung client-side
  oleh `calcHPP`.
- **recipe_items**: komponen resep — bisa `item_id` (bahan baku) ATAU
  `sub_recipe_id` (resep lain), `quantity_used`. Mendukung **resep berlapis**
  (recipe-of-recipe).
- **productions**: catatan produksi batch — `recipe_id`, `batches`, `total_cost`,
  menambah stok sub-recipe/produk dan mengurangi stok bahan baku.
- **sales** (header transaksi): `category_id`, `created_at`. (Skema awal
  menyimpan 1 produk per sale; migrasi 011 memecah jadi multi-item.)
- **sale_items**: baris produk dalam transaksi — `recipe_id`, `quantity_sold`,
  `selling_price`, `hpp_at_sale` (snapshot HPP saat jual), `hpp_addons_at_sale`.
- **sale_addons**: add-on per baris penjualan — `item_id` atau `sub_recipe_id`,
  `quantity`, `price_per_unit_at_sale`, `name_at_sale` (snapshot nama).
- **sale_categories**, **expense_categories**: master kategori.
- **expenses** (pengeluaran operasional): `name`, `qty`, `price`, `total`,
  `category_id`, `note`, `created_at`.
- **user_profiles**: profil + trigger saat signup (migrasi 008).

### RPC penting (`SECURITY DEFINER`, semua dijaga `auth.uid()` guard sejak 008)
- `record_purchase` — insert pembelian + update stok + **recalc weighted average**.
- `update_purchase` / `delete_purchase` — sesuaikan delta stok & recalc avg dari
  pembelian tersisa.
- `produce_recipe` / `produce_sub_recipe` — catat produksi, tambah stok produk,
  kurangi stok bahan.
- `update_production` / `delete_production` — reverse/adjust stok.
- `adjust_item_stock` (dengan guard stok negatif), `deduct_sub_recipe_stock`,
  `restore_sub_recipe_stock`, `restore_recipe_stock` — dipakai saat jual/edit/hapus.

### Rumus HPP (`calcHPP` di `useRecipes.ts`)
```
rawCost = Σ (harga_per_unit_bahan × quantity_used)
          (rekursif untuk sub_recipe: pakai HPP per unit sub-recipe)
effectiveYield = max(batch_yield × (1 − waste_pct/100), 0.001)
HPP_per_unit = rawCost / effectiveYield
```
- `usePrev=false` → pakai `avg_price` sekarang (HPP terkini).
- `usePrev=true` → pakai `prev_avg_price` (HPP sebelum pembelian terakhir) →
  untuk menampilkan **tren naik/turun HPP**.
- Rekursif: sub-recipe dihitung HPP per unitnya dulu, lalu dikali quantity.

---

## 5. Fitur per Modul — Fungsi, Flow, Edge Case

### 5.1 Auth & Layout (selalu aktif)
**Fungsi:** Login email+password (Supabase), session via cookie. `middleware.ts`
melindungi semua route: belum login → `/login`; sudah login buka `/login` →
`/dashboard`; root `/` → `/dashboard`; route fitur tak-dibeli → `/dashboard`.
Sidebar render menu hanya untuk fitur yang aktif.

**Flow:** buka domain → middleware cek session → login → dashboard.

**Edge case:**
- Env Supabase kosong → diperlakukan unauthenticated (redirect login), tidak error 500.
- Supabase unreachable → `try/catch` di middleware tetap fallback ke login, **tidak pernah lempar 500**.
- Akses langsung URL fitur tak-dibeli → redirect dashboard (tapi ini UX gating, bukan security).

### 5.2 Bahan Baku / Items (`/items`)
**Fungsi:** CRUD bahan baku. Tampilkan stok & avg_price terkini. `avg_price` &
`stock` **tidak diisi manual** — keduanya dihitung dari pembelian. Saat create,
`avg_price=0`, `stock=0`. Mendukung import Excel (ImportExcelModal). Bisa tandai
item sebagai `is_addon` + set `selling_price` (untuk dipakai sebagai add-on jual).

**Flow:** tambah item (nama+unit) → harga & stok terisi otomatis setelah pembelian pertama.

**Edge case:**
- Hapus item yang sudah dipakai di resep/pembelian → FK `on delete restrict`
  pada purchases/recipe_items → gagal hapus (terproteksi).
- Unit dibatasi enum (gr/ml/pcs/kg/liter) di skema awal; satuan custom dikelola terpisah.

### 5.3 Pembelian / Purchases (`/purchases`)
**Fungsi:** Catat pembelian bahan baku. Inti: **weighted average costing**.
Rumus: `avg_baru = (stok_lama×avg_lama + qty_baru×harga_baru) / (stok_lama+qty_baru)`.
Mendukung **input berbasis kemasan** (mis. beli 2 dus × 500gr) → dikonversi ke
satuan dasar. Bisa backdate `created_at`. Edit & hapus pembelian akan
**recalc ulang** avg dari pembelian tersisa.

**Flow:** pilih item → input qty+harga (atau via kemasan) → `record_purchase` RPC →
stok naik, avg_price ter-update, `prev_avg_price` menyimpan avg lama → HPP semua
resep yang pakai item ini otomatis berubah (invalidate cache items+recipes).

**Edge case (banyak bug historis di sini):**
- `price_per_unit` adalah **generated column** — tidak boleh di-insert eksplisit
  (bug 002, 005, 005_fix, 016). Ada **dua overload `record_purchase`** yang
  pernah bentrok (016).
- Backdate tanggal: jika tanggal = hari ini pakai `now()` asli (akurat relatif
  ke record lain); tanggal lampau pakai **jam 12 siang lokal** untuk hindari
  pergeseran hari karena offset UTC.
- Hapus pembelian → stok bisa jadi negatif jika sudah terpakai produksi; recalc
  avg dari sisa pembelian (jika kosong → avg fallback ke harga terakhir).
- Edit pembelian mengubah HPP retroaktif untuk resep — tapi `hpp_at_sale` pada
  penjualan lama **tidak** ikut berubah (snapshot, by design).

### 5.4 Produk & Resep / Recipes (`/recipes`)
**Fungsi:** Definisikan produk dan komposisi bahannya. HPP dihitung real-time.
Mendukung:
- **Resep berlapis** (sub-recipe sebagai komponen resep lain).
- **Bahan setengah jadi** (`is_ingredient=true`) yang punya stok & avg sendiri
  (diproduksi via modul Produksi).
- `batch_yield` (1 batch → N unit) & `waste_pct` (susut) untuk HPP akurat.
- `hpp_baseline` untuk bandingkan dengan target.
- Tandai produk/sub-recipe sebagai `is_addon` (jadi opsi add-on penjualan).
- Simpan `selling_price` (harga jual diingat dari transaksi terakhir).

**Flow:** buat resep → pilih bahan baku &/atau sub-recipe + qty → set
yield/waste → HPP muncul instan. Edit resep = delete semua recipe_items lama,
insert baru (bukan diff).

**Edge case:**
- `recipe_items` unik per `(recipe_id, item_id)` di skema awal → tidak bisa item
  sama dua baris.
- **Cycle guard (severity RENDAH — sudah ter-mitigasi).** `calcHPP` rekursif
  tanpa cycle guard eksplisit, TAPI praktis hampir mustahil meledak: (a) DB
  constraint `no_self_reference` + filter UI mencegah self-reference (A→A) dan
  lingkaran langsung 2-arah (A↔B); (b) query `useRecipes` hanya load sub-recipe
  1 level dalam → rekursi mentok di kedalaman 2, tak ada data untuk infinite
  loop. Sisa celah teoretis: lingkaran ≥3 (A→B→C→A) via edit berlapis. Hanya
  relevan jika query diperdalam / filter UI dilonggarkan di masa depan.
- `effectiveYield` di-clamp minimal `0.001` agar tidak bagi nol saat
  yield/waste ekstrem.
- HPP pakai `prev_avg_price || avg_price || 0` saat mode prev → item baru tanpa
  pembelian → HPP 0.

### 5.5 Produksi / Produksi (`/produksi`)
**Fungsi:** Catat produksi batch. Dua mode:
- **Produk jadi** (`produce_recipe`) — tambah stok produk jadi.
- **Bahan setengah jadi** (`produce_sub_recipe`) — tambah stok sub-recipe.
Keduanya **otomatis mengurangi stok bahan baku** sesuai resep × batch.
Pre-check stok bahan baku sebelum produksi (untuk kedua mode).

**Flow:** pilih resep → input jumlah batch → sistem hitung total_cost & cek stok
bahan cukup → `produce_*` RPC → stok bahan turun, stok produk/sub naik → tercatat
di tabel productions. Bisa edit (sesuaikan batch) & hapus (reverse stok).

**Edge case:**
- Stok bahan baku kurang → ditolak / ditampilkan "bahan setengah jadi kurang",
  ada opsi "Produksi Bahan & Lanjutkan" (produksi bahan setengah jadi dulu baru
  lanjut produk jadi) dengan `batches: shortfall`.
- Hapus/edit produksi harus reverse stok di **dua arah** (bahan baku naik lagi,
  produk turun) — migrasi 019 memperbaiki restorasi stok sub-recipe pada
  delete/update.
- **BOM snapshot (migrasi 021, RESOLVED).** Sebelumnya delete/update produksi
  merekonstruksi qty dari resep LIVE → kalau resep diedit setelah produksi,
  stok dikembalikan dengan jumlah salah (atau nol kalau bahan dihapus dari
  resep). Migrasi 021 menambah tabel `production_items` yang men-snapshot
  per-batch `quantity_used` saat produksi; delete/update kini restore dari
  snapshot, fallback ke resep live hanya untuk produksi lama tanpa snapshot.
  Sudah di-apply ke kedua DB (tata-data-dapur + my-kitchen-book). Catatan: DB
  klien punya riwayat migrasi terpisah — selalu cek status apply per-DB.
- **Guard stok-negatif di `update_production` (migrasi 022, RESOLVED).**
  Menaikkan jumlah batch produksi men-deduct bahan tambahan; sebelumnya tanpa
  guard (bisa diam-diam minus). 022 menambah pre-check (selaras guard di
  `produce_recipe`): tolak jika deduksi ekstra membuat stok < 0. Mengurangi
  batch (restore) tidak di-guard. Applied ke kedua DB.
- Backdate sama seperti pembelian (noon lokal untuk tanggal lampau).

### 5.6 Penjualan / Sales (`/sales`) — modul terbesar (~23k token)
**Fungsi:** Catat transaksi penjualan multi-item dengan add-on.
- 1 transaksi (sale) = header + banyak `sale_items` (produk) + tiap item bisa
  punya `sale_addons`.
- Snapshot **`hpp_at_sale`** & **`hpp_addons_at_sale`** disimpan saat jual
  (HPP saat itu, kebal perubahan harga bahan kemudian).
- Kurangi stok produk jadi (`deduct_sub_recipe_stock`) + stok add-on
  (item via `adjust_item_stock`, sub-recipe via `deduct_sub_recipe_stock`).
- Kategori penjualan (master `sale_categories`).
- Ingat harga jual terakhir produk (`persistSellingPrices`) — **kecuali** harga
  combo (produk + add-on) tidak disimpan sebagai harga dasar produk.

**Flow create:** pilih kategori+tanggal → tambah produk (qty, harga jual, HPP
auto dari resep) → opsional tambah add-on per produk → submit → insert sale →
loop tiap item: insert sale_item + deduct stok produk + insert addons + deduct
stok addon → simpan harga jual → invalidate sales/dashboard/recipes/items.

**Flow edit/hapus:** restore SEMUA stok lama (produk + addon) dulu → delete
sale_items (cascade addon) → re-insert baru + deduct lagi. Hapus = restore stok
lalu delete sale.

**Edge case:**
- Operasi **tidak atomik** di level transaksi DB — dilakukan sekuensial dari
  client (insert sale → items → addons → RPC stok). Jika gagal di tengah,
  bisa **partial state** (sale terbuat tapi sebagian stok belum ke-deduct).
  Risiko konsistensi nyata.
- `adjust_item_stock` punya guard stok negatif (migrasi 020) → jual add-on
  melebihi stok bisa ditolak di tengah loop → partial sale.
- `persistSellingPrices` bersifat **best-effort** (`try/catch` diam) — gagal
  update harga tidak menggagalkan penjualan.
- Edit sale me-restore stok pakai `restore_recipe_stock` lalu deduct ulang —
  jika qty berubah, selisih harus benar; bug historis seputar restore sub-recipe.
- `hpp_addons_at_sale` dihitung dari `hpp_per_unit ?? price_per_unit_at_sale` —
  kalau HPP add-on tak diberikan, **pakai harga jual sebagai proxy HPP** (bisa
  bikin margin add-on tampak 0).
- Backdate sale pakai `new Date(date).toISOString()` (beda dari purchases yang
  pakai noon-lokal) → potensi inkonsistensi pergeseran hari antar modul.

### 5.7 Pengeluaran / Expenses (`/expenses`)
**Fungsi:** Catat biaya operasional (gas, listrik, gaji, sewa, dll) di luar
bahan baku. `total = qty × price` (atau diisi manual), kategori, catatan,
tanggal. Query harian (`useExpensesByDate`) & untuk laporan (`useReportExpenses`).

**Flow:** pilih tanggal+kategori → input nama/qty/harga → simpan. Dipakai laporan
untuk hitung **laba bersih** (laba kotor − pengeluaran).

**Edge case:**
- `useExpensesByDate` pakai range `>= date` dan `< date+1` via ISO split →
  sensitif timezone (boundary tengah malam UTC vs lokal).
- Limit query expenses 200 baris terbaru di list utama.

### 5.8 Dashboard (`/dashboard`)
**Fungsi:** Ringkasan: total revenue, total HPP, total profit, profit margin,
jumlah transaksi. Dihitung client-side dari semua `sale_items`
(`total_hpp = Σ hpp_at_sale×qty + hpp_addons_at_sale`; `sales_count` = jumlah
`sale_id` unik).

**Edge case:**
- Agregasi ambil **semua** sale_items tanpa limit → bisa berat saat data besar
  (tidak ada agregasi server-side).
- Profit margin = 0 jika revenue 0 (guard pembagian).

### 5.9 Laporan / Reports (`/reports`) — modul besar (~15k token)
**Fungsi:** Laporan laba-rugi & analitik. Periode: Hari ini, Minggu, Bulan ini,
Bulan lalu, Custom range. Granularitas: Harian, Mingguan. Metrik: Pendapatan,
Total HPP (biaya bahan), Total Pengeluaran, Laba Kotor, Laba Bersih, Margin
Kotor/Bersih (%), Jumlah Transaksi. Breakdown per Kategori & **Top Produk**.
Grafik tren (Recharts) "Pendapatan & Laba — 7/30 Hari Terakhir". Export laporan
ke gambar (html-to-image) & Excel (xlsx).

**Flow:** pilih periode → ambil `report-sales` + `report-expenses` (tanpa limit,
ascending) → agregasi client-side → render kartu + chart + tabel → export.

**Edge case:**
- Semua perhitungan client-side dari full dataset → skala besar = lambat/berat.
- Filtering tanggal client-side rentan timezone (sama seperti expenses).
- "Tanpa Kategori" untuk transaksi tanpa kategori.

### 5.10 Pengaturan / Settings (`/settings`)
**Fungsi:** Pengaturan akun & master data. Ubah **nama toko**, **email**
(`email_change` Supabase), **password**. Kelola master **satuan custom**
(custom units) & **jenis kemasan** (packaging types). `force-dynamic`.

**Edge case:**
- Ganti email butuh konfirmasi (flow Supabase `email_change`) → bisa gagal
  ("Konfirmasi gagal").
- Password baru harus cocok ("Password tidak cocok").

### 5.11 Kasir / POS (`/kasir`) — ADD-ON (paket Kasir)
**Fungsi:** Modul Point-of-Sale (add-on berbayar, `core: false`). Hanya muncul
jika `NEXT_PUBLIC_ENABLED_FEATURES=kasir`. Untuk transaksi cepat di kasir
(berbeda dari modul Penjualan yang lebih untuk pencatatan/rekap). Fitur pertama
dari roadmap paket add-on.

**Edge case:**
- Jika klien tak beli, route di-gate middleware (redirect dashboard) & menu
  disembunyikan Sidebar.

---

## 6. Flow Lintas-Modul (End-to-End)

**Siklus operasional lengkap:**
```
1. Items: daftar bahan baku (nama+unit)
2. Purchases: beli bahan → stok & avg_price (weighted avg) terisi
3. Recipes: susun produk dari bahan/sub-recipe → HPP terhitung
4. Produksi (opsional): produksi batch → stok produk naik, stok bahan turun
5. Sales/Kasir: jual produk (+add-on) → stok turun, HPP di-snapshot, profit tercatat
6. Expenses: catat biaya operasional
7. Dashboard/Reports: lihat revenue, HPP, laba kotor & bersih, margin, top produk
```

**Rantai dependensi data (penting untuk brainstorm konsistensi):**
- Pembelian → mengubah `avg_price` → mengubah HPP semua resep terkait
  (real-time, tapi TIDAK mengubah `hpp_at_sale` penjualan lama).
- Produksi & Penjualan → mengubah stok lewat RPC; edit/hapus harus reverse stok
  dengan benar (area paling rawan bug — lihat migrasi 019/020).
- Laporan & Dashboard → agregasi murni client-side dari snapshot.

---

## 7. Tema Brainstorm yang Mungkin Berguna

Area yang menonjol untuk didiskusikan/ditingkatkan:

1. **Atomicity penjualan** — create/edit sale dilakukan multi-step dari client
   (non-transaksional). Kandidat dipindah ke satu RPC `record_sale` agar atomik
   & anti partial-state.
2. **Konsistensi penanganan tanggal/timezone** — purchases pakai noon-lokal,
   sales pakai ISO langsung, expenses pakai range UTC-split. Perlu satu util
   tanggal terpusat.
3. **Cycle guard pada sub-recipe** — `calcHPP` rekursif tanpa proteksi loop;
   severity RENDAH (sudah ter-mitigasi constraint DB + filter UI + query dangkal).
   Catatan defensif saja, bukan bug aktif.
4. **Skalabilitas agregasi** — dashboard & reports tarik semua baris ke client;
   pertimbangkan RPC/materialized view untuk agregasi server-side.
5. **HPP add-on** — fallback "harga jual sebagai HPP" bisa menyesatkan margin.
6. **Stok negatif & restorasi** — sebagian besar sudah ditangani: guard di
   `produce_recipe`/`produce_sub_recipe`/`deduct_sub_recipe_stock` (019),
   `adjust_item_stock` (020), `update_production` (022); restorasi akurat via
   BOM snapshot `production_items` (021). Sisa: jalur penjualan (`useCreateSale`/
   `useUpdateSale`) masih non-atomik di client (lihat poin #1) — partial state
   masih mungkin saat add-on melebihi stok di tengah loop.
7. **Otomasi provisioning** — Supabase Management API + Cloudflare API + skrip.
8. **Migrasi per-klien** — saat ini manual ke tiap DB; perlu orkestrasi.
9. **Roadmap add-on berikutnya** setelah Kasir (mis. multi-user/role, laporan
   pajak, integrasi marketplace, manajemen pelanggan/utang).

---

*Generated sebagai bahan brainstorm. Sumber: kode `src/`, `supabase/migrations/`,
dan `docs/` per 2026-06-13.*
