# Riset: Payment Link / Terima Pembayaran Otomatis

> Status: **DRAFT — bahan diskusi**, belum diputuskan apa pun.
> Dibuat: 2026-06-13. Konteks: pertanyaan apakah bisa terima pembayaran (VA/QRIS/CC)
> tanpa pakai payment gateway berbayar, untuk app TataData-Dapur.

## Apa yang diriset

Produk "payment link" (lihat thread Threads): seller kirim **satu link**, customer
bebas pilih bayar pakai VA / CC / QRIS, seller tinggal pantau pembayaran masuk —
tanpa transfer manual + kirim bukti.

Itu **bukan** bypass payment gateway. Produk semacam itu adalah **wrapper/reseller
di atas aggregator** (kemungkinan besar Xendit / Midtrans / Mayar / iPaymu).

## Arsitektur payment link (umum)

```
Seller bikin link (nominal + deskripsi)
        ↓
Hosted checkout page (link itu) → tampil opsi VA / CC / QRIS
        ↓
Customer pilih metode → bayar
        ↓
Gateway/aggregator proses ke bank / switching network
        ↓
Webhook / callback → status "PAID" → seller dapat notifikasi
        ↓
Settlement (dana cair ke rekening seller, dipotong fee)
```

Inti nilainya:
- **Webhook** → konfirmasi otomatis "uang masuk" (no cek manual).
- **Hosted page** → gak perlu bangun halaman bayar + PCI sendiri.

## Bisa tanpa payment gateway? — 3 lapis

### 1. Full bikin sendiri dari nol → praktis TIDAK
- **QRIS**: diatur Bank Indonesia, butuh NMID dari acquirer berlisensi. Gak bisa self-issue.
- **VA (Virtual Account)**: diterbitkan bank, butuh perjanjian korporat + minimum volume.
- **CC**: butuh acquiring bank + sertifikasi **PCI-DSS**.
- Konsekuensi: harus jadi **PJP (Penyedia Jasa Pembayaran) berlisensi BI** sendiri —
  modal besar + beban regulasi. Tidak realistis untuk perorangan/UMKM.

### 2. Tanpa "payment gateway" tapi tetap OTOMATIS → BISA (kandidat utama)
- Pakai **rekening bank biasa + cek mutasi otomatis** (gaya **Moota**, OtomatiS).
- Trik **nominal unik**: tiap order dikasih nominal beda di digit terakhir
  (mis. Rp 100.**123**). Sistem baca mutasi rekening → cocokin nominal → auto-konfirmasi.
- Plus **QRIS statis** dari satu merchant (GoPay / Dana / bank) untuk opsi QR.
- **Fee**: tidak ada fee gateway per-transaksi; hanya fee layanan mutasi (flat/kecil).
- **Kelemahan**:
  - Hanya transfer bank & QR (tidak ada CC).
  - Matching bisa bentrok kalau 2 order bernominal sama dalam waktu berdekatan →
    perlu manajemen nominal unik / window waktu.
  - QRIS statis = rekonsiliasi per-nominal, bukan per-invoice resmi.

### 3. Pakai aggregator (yang dipromosikan di thread) → mudah, tapi ada fee
- Xendit / Midtrans / Mayar / iPaymu / Doku / Flip for Business.
- Estimasi fee (cek terbaru saat eksekusi):
  - QRIS ~0.7%
  - VA ~Rp 4.000 / transaksi
  - CC ~2.9% + komponen tetap

## Ringkasan perbandingan

| Cara | VA | QRIS | CC | Auto-konfirmasi | Fee | Susah bangun | Legal |
|------|----|----|----|------------------|-----|--------------|-------|
| Gateway (Xendit dll) | ✓ | ✓ | ✓ | webhook | per-trx | rendah | ditangani provider |
| Mutasi-match (Moota) | transfer manual | statis | ✗ | ✓ (baca mutasi) | flat kecil | sedang | aman (rekening pribadi) |
| Bikin sendiri (PJP) | ✓ | ✓ | ✓ | ✓ | infra | sangat tinggi | butuh lisensi BI |

## Arah yang masuk akal untuk app ini (hipotesis awal)

- Kalau prioritas **hemat fee + tetap otomatis** → **mutasi-match (Moota-style) + QRIS statis**.
- Kalau prioritas **lengkap (CC, multi-bank, instan) + minim ribet legal** → **aggregator**.

## TODO diskusi lanjutan
- [ ] Tentukan prioritas: hemat fee vs kelengkapan metode vs kecepatan rilis.
- [ ] Volume transaksi perkiraan (pengaruh ke pilihan fee flat vs persentase).
- [ ] Apakah CC benar-benar dibutuhkan? (kalau tidak, opsi #2 jauh lebih murah.)
- [ ] Breakdown arsitektur opsi #2 untuk integrasi ke TataData-Dapur (jika dipilih).
- [ ] Cek harga & syarat terbaru Moota / Xendit / Midtrans saat eksekusi.
