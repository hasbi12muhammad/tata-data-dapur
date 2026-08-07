# STATUS — tata-data-dapur

> Single source of truth for resuming work. Read this FIRST when starting a session.
> Update this file at the end of every work phase so the next `/clear` resumes in 1 read.
> Last updated: 2026-08-04

---

## ✅ Done

<!-- Move items here from "🚀 Next phase" when finished. Group by area. -->

**Security audit 5 layer (2026-08-04)** — deps / secrets / injection / authz. Hasil: 1 Critical, 2 High, 3 Medium/Low. Detail lengkap di `.wolf/buglog.json` bug-072..074.

- **CRITICAL bug-072 — webhook Pakasir tanpa verifikasi (FIXED, belum deploy).** `verifyWithPakasir()` di `src/app/api/pakasir/webhook/route.ts` callback ke `GET https://app.pakasir.com/api/transactiondetail` sebelum aksi akun apa pun; amount diambil dari baris `orders` di DB, bukan payload. Fail-closed (503/502/402). Guard tambahan: password akun existing tidak di-reset kecuali retry order yang sama → else `needs_review` + 409.
- **HIGH bug-073 — password plaintext (FIXED, belum deploy).** Webhook menghapus `orders.generated_password` begitu email terkirim. Repo `tata-data-admin`: resend-email jadi reset password baru, plus endpoint baru `POST /orders/:orderId/reset-password` untuk alur WA (tidak email, tidak disimpan). UI Orders: "Reset & Kirim Password" + "Reset & Copy untuk WA".
- **HIGH bug-074 — RLS tabel tak tercatat (FIXED + APPLIED).** Migrasi `028_rls_untracked_tables.sql` (expenses, expense_categories, sale_categories) — sudah dijalankan user manual di Supabase SQL Editor 2026-08-04.
- **DEPLOYED 2026-08-04.** App: branch `fix/security-pakasir-webhook` merged ke `main` (`63f6952..e099489`), Cloudflare Pages project `tatadata-dapur` build produksi hidup. Admin: `fix/security-order-passwords` merged ke `master` (`6d2e275..8e94c68`) + `wrangler deploy` (Version ID `f63d6489-dfa8-414a-a38b-ca681e8793a1`).
- Verifikasi produksi (POST ke `app.tatadatadapur.my.id/api/pakasir/webhook`): tanpa order_id → `400 missing order_id` (kode baru; kode lama menjawab 404 karena terlanjur query DB), project asing → `400 unknown project`, order palsu → `404 order not found`, `/login` → 200.
- Secrets Pages `tatadata-dapur`: environment **production** punya PAKASIR_API_KEY + RESEND_API_KEY + SUPABASE_SERVICE_ROLE_KEY; environment **preview KOSONG** — preview deployment tidak bisa dipakai menguji alur bayar sampai secretnya ditambahkan.

---

## 🚀 Next phase

**Goal:** Uji alur bayar end-to-end di produksi, lalu bereskan sisa temuan Medium.

### Acceptance criteria
1. Satu order asli (atau nominal kecil) lewat landing page → Pakasir → webhook: akun terbuat, email kredensial masuk, dan `orders.generated_password` kembali NULL setelah email terkirim.
2. Tombol "Reset & Copy untuk WA" di dashboard admin diuji sekali pada order nyata: password lama mati, yang baru tersalin.
3. Keputusan diambil untuk 2 open decision di bawah.

### Files to create / edit
| Type | File | Content |
|---|---|---|
| — | (belum ada; tergantung open decision) | |

### Closed decisions
- Verifikasi pembayaran = callback ke API Pakasir, bukan signature — Pakasir memang tidak menyediakan signature (docs `pakasir.com/p/docs`).
- Password plaintext dihapus setelah email terkirim; fitur admin yang bergantung padanya diubah jadi "reset password baru".

### Open decisions
- Policy `anon_insert_orders` (`with check (true)`) di `026_orders_table.sql` masih membiarkan siapa pun spam baris `orders`. Sudah tidak berbahaya untuk akun, tapi perlu diputuskan: pindahkan pembuatan order ke endpoint server, atau tambahkan rate limit?
- `xlsx` (high, no fix upstream) — pindah ke SheetJS CDN 0.20.3+ atau `exceljs`?

---

## 📁 Active architecture

- **Stack:** _<frameworks, libraries, runtime>_
- **Key tables / modules:** _<list>_
- **Patterns:** _<conventions enforced project-wide>_

---

## ⚠️ External blockers (don't block coding)

- _<env vars, secrets, external accounts, manual steps>_

---

## 🔧 Useful commands

```bash
# add the most-used commands here so the next session has them ready
```

---

## 📚 References (read IF needed)

- `.wolf/cerebrum.md` — User Preferences + Do-Not-Repeat + Decision Log
- `.wolf/anatomy.md` — token-efficient file index
- `.wolf/buglog.json` — known bugs + fixes
