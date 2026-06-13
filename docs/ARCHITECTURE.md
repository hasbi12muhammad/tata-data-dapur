# Arsitektur Multi-Tenant (Base App + Paket Fitur)

Dokumen ini menjelaskan bagaimana satu codebase melayani banyak klien, di mana
tiap klien membeli paket fitur yang berbeda dan punya database sendiri.

## Prinsip inti

> **Satu codebase untuk semua klien. Perbedaan antar klien HANYA di env var,
> tidak pernah di cabang kode.**

Aturan ini yang membuat "update base app → semua klien ikut update otomatis"
berhasil: setiap deployment klien dibuild dari repo/branch yang sama, jadi
begitu kamu push ke base, Cloudflare Pages auto-deploy ulang setiap klien.

```
                ┌──────────────────────────┐
                │   Repo base app (1 buah)  │
                │   semua fitur + Kasir dll │
                └────────────┬─────────────┘
            push → auto-deploy ke semua deployment
        ┌────────────────┬───┴────────────┬────────────────┐
        ▼                ▼                 ▼                ▼
  Deploy Klien A   Deploy Klien B    Deploy Klien C   ...
  domain A         domain B          domain C
  Supabase A       Supabase B        Supabase C       (DB terpisah)
  ENABLED=kasir    ENABLED=          ENABLED=kasir
```

## Tiga lapis pembeda per klien

| Lapis | Mekanisme | Env var |
|---|---|---|
| **Database** | Tiap klien = 1 Supabase project sendiri | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **Fitur/paket** | Feature flag dibaca registry entitlement | `NEXT_PUBLIC_ENABLED_FEATURES`, `NEXT_PUBLIC_DISABLED_FEATURES` |
| **Branding** | Nama bisnis & plan | `NEXT_PUBLIC_TENANT_NAME`, `NEXT_PUBLIC_TENANT_PLAN` |

## Sistem fitur / entitlement

- `src/lib/features/registry.ts` — daftar semua fitur. `core: true` = bagian
  paket dasar (nyala default), `core: false` = add-on (mati default).
- `src/lib/features/entitlements.ts` — menghitung fitur aktif dari env:
  - `isFeatureEnabled(id)` — dipakai Sidebar untuk menyembunyikan menu.
  - `isPathAllowed(path)` — dipakai `middleware.ts` untuk blokir route fitur
    yang tidak dibeli (redirect ke /dashboard).
- `src/lib/tenant/config.ts` — `getTenantConfig()` untuk nama/plan/fitur.

### Menambah fitur add-on baru (mis. Kasir)

1. Tambah entry di `FEATURES` (registry.ts) dengan `core: false` + `routes`.
2. Buat halaman di `src/app/<route>/`.
3. Tambah entry nav di `Sidebar.tsx` dengan `feature: "<id>"`.
4. Kalau perlu tabel DB, tambahkan migrasi di `supabase/migrations/` (dijalankan
   ke database tiap klien yang membeli fitur tsb).

Menu & route otomatis tergating — tidak ada `if` per-klien yang di-hardcode.

## Paket yang dijual

| Paket | Fitur | Cara aktifkan |
|---|---|---|
| Base | dashboard, items, purchases, expenses, recipes, produksi, sales, reports | default |
| Kasir | + Kasir/POS | `NEXT_PUBLIC_ENABLED_FEATURES=kasir` |

> Catatan: gating berbasis env adalah kontrol UX, bukan batas keamanan keras.
> Karena tiap klien punya database & deployment sendiri, isolasi data sudah
> dijamin di level infrastruktur (database terpisah + RLS Supabase).

Lihat `PROVISIONING.md` untuk langkah onboarding klien baru.
