# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-04-20

## User Preferences

<!-- How the user likes things done. Code style, tools, patterns, communication. -->

## Key Learnings

- **Project:** tata-data-dapur
- **HPP badge bug:** `prev_avg_price` di DB bernilai 0 (bukan null) untuk item yang belum pernah diupdate harganya. `??` tidak menangkap 0, jadi kalkulasi prev_hpp menjadi sangat kecil dan persentase kenaikan menjadi misleading. Fix: gunakan `||` agar 0 fallback ke avg_price.
- **Sales page pattern:** Edit modal reuse create modal — `editing: Sale | null` state sebagai flag, `openEdit()` pre-fill form, `closeModal()` clear editing + close, guard `(editing || selectedRecipe)` untuk profit preview.
- **useDeletePurchase:** Delete langsung dari tabel `purchases`, TIDAK via RPC. Tidak me-revert perubahan stock/avg_price — user harus sadar ini.
- **Date filter purchases:** State `filterDateFrom`/`filterDateTo` di-filter di useMemo client-side. Gunakan `setHours(0,0,0,0)` dan `setHours(23,59,59,999)` untuk full-day range.
- **Description:** This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->

## Decision Log

<!-- Significant technical decisions with rationale. Why X was chosen over Y. -->
