# Design Spec: Video Promosi "PromoResep" — Resep + Harga Adaptif

**Date:** 2026-06-29
**Status:** Approved
**Project:** `/home/hasbi/Proyek/TataData-Dapur/promo-video` (Remotion)

---

## Overview

Komposisi Remotion baru bernama `PromoResep`, terpisah dari `Promo` lama (tidak disentuh).
Konsep: **Tata Data Dapur bisa bikin resep, dan HPP-nya nyesuain sendiri saat harga bahan baku berubah.**

Benang merah:
> Bikin resep → HPP langsung kehitung → harga bahan naik → HPP & saran harga jual ikut nyesuain otomatis.

Spec teknis sama persis dengan `Promo`: 1080×1920 (9:16), 30 fps, 900 frame (30 detik).

---

## Scene Breakdown (900 frames @ 30fps)

| # | Scene | Frames | Durasi | Sumber | Komponen |
|---|-------|--------|--------|--------|----------|
| 1 | Pain | 0–120 | 4s | React | `Pain` (reuse + copy baru via prop) |
| 2 | Intro | 120–210 | 3s | React | `Intro` (reuse as-is) |
| 3 | RecipeFlow | 210–480 | 9s | **Rekaman app asli** | `RecipeFlow` (reuse, video `recipe-flow.mp4` direkam ulang) |
| 4 | PriceAdapt | 480–770 | 9.7s | React sintetik | `PriceAdapt` (BARU) |
| 5 | Outro | 770–900 | 4.3s | React | `Outro` (reuse as-is) |

Transisi antar-scene pakai pola `Fade` yang sudah ada di `Promo.tsx` (in 14 frame, out 14 frame).

---

## Copy Final (humanized, santai)

Sudah lewat skill `humanizer`: tanpa em dash, tanpa bahasa promosi berlebihan, panjang kalimat bervariasi.

| Slot | Copy |
|------|------|
| Pain 1 | "Harga cabe naik, harga jualmu masih segitu aja?" |
| Pain 2 | "Jualan laris, tapi untungnya kok mepet?" |
| Pain 3 | "Tiap bahan naik, mesti ngitung ulang dari nol?" |
| Pain turn | "Tenang, ada cara gampangnya." |
| Intro subtitle | (tetap) "Jualan makanan, untungnya kelihatan jelas." |
| RecipeFlow kicker | "Hitung HPP" |
| RecipeFlow caption | "Masukin bahannya, modal per porsi langsung muncul." |
| RecipeFlow callout | "ngitung sendiri" |
| PriceAdapt kicker | "Harga bahan baru" |
| PriceAdapt badge bahan | "naik 36%" |
| PriceAdapt HPP label | "HPP per porsi" |
| PriceAdapt banner | "Naikin harga ke Rp 19.000, untungmu balik kayak semula." |
| PriceAdapt caption | "Harga bahan berubah, HPP sama saran harganya ikut nyesuain sendiri." |
| Outro | (tetap) "Coba Sekarang" |

---

## Scene 4 — PriceAdapt (komponen baru, bintangnya)

Layout meniru `RecipeHPP.tsx` (AppBar + Card daftar bahan + Card hasil HPP) supaya nyambung
secara visual dengan scene 3.

### Data (selaras dengan resep yang direkam di scene 3)

Resep: **Pancake Susu Cokelat**, harga jual Rp 17.000. (Resep ini yang dibangun `record.mjs`
di scene 3, jadi scene 4 selaras dengan rekaman.)

Bahan & modal awal (per porsi):

| Bahan | Qty | Modal awal | Modal setelah naik |
|-------|-----|-----------|-------------------|
| Tepung | 50 gr | Rp 600 | Rp 600 |
| Susu UHT | 100 ml | Rp 2.200 | **Rp 3.000** (naik 36%) |
| Telur | 1 butir | Rp 2.500 | Rp 2.500 |
| Topping Cokelat | 20 gr | Rp 1.800 | Rp 1.800 |
| Gas + Kemasan | 1 porsi | Rp 1.400 | Rp 1.400 |

- HPP awal = Rp 8.500 → HPP baru = **Rp 9.300**
- Margin @Rp 17.000: 50% → **45%**
- Saran harga jual baru = **Rp 19.000** (margin balik ~51%)

> Catatan: resep diganti dari rencana awal (Nasi Ayam Geprek) ke Pancake Susu Cokelat,
> yaitu resep yang memang dibangun `record.mjs`, supaya scene 3 (rekaman app asli) dan
> scene 4 (sintetik) konsisten tanpa bergantung pada bahan yang kebetulan ada di akun demo.

### Timeline internal (local frame 0–290)

| Local frame | Aksi |
|-------------|------|
| 0–40 | Card resep + baris bahan settle (fade cepat, ini kelanjutan scene 3) |
| 40–80 | Baris "Dada Ayam" flash terracotta, harga count `Rp 5.400 → 7.200`, badge "naik 33%" muncul |
| 80–140 | Kartu HPP re-count `Rp 12.500 → 14.300`, glow pulse |
| 120–170 | Kartu margin `50% → 43%`, warna geser verde → amber |
| 170–230 | Banner saran slide-up: "Naikin harga ke Rp 29.000, untungmu balik kayak semula." |
| 230–290 | Hold |

Pakai komponen UI yang sudah ada: `AppBar`, `Card`, `Kicker`, `Caption`, `Pill`, helper `rupiah`,
palet `C` dari `theme.ts`, font dari `fonts.ts`, `Decor`/`Grain` dari `decor.tsx`.

---

## Rekaman Scene 3 (app asli)

- App: TataData-Dapur (Next.js) jalan di `http://localhost:3000`
- Tooling sudah ada: `record.mjs` (puppeteer-core + Chrome `/usr/bin/google-chrome`, CDP screencast)
- Kredensial demo: `akun-demo@tatadata-dapur.com` / `hasbi123456` (sudah hardcoded di `record.mjs`)
- Output: `frames/` → ffmpeg concat → `public/shots/recipe-flow.mp4`
- Ubah `record.mjs`: resep yang dibangun diganti jadi resep yang dipakai scene 4 (mis. Nasi Ayam
  Geprek) dengan bahan yang harganya akan dinaikkan di scene 4.

Prasyarat rekam: dev server TataData-Dapur hidup di :3000. Kalau tidak bisa direkam saat ini,
`recipe-flow.mp4` lama tetap dipakai sebagai fallback dan scene 4 disesuaikan dengan resep lama.

---

## Perubahan Kode

| File | Aksi |
|------|------|
| `src/scenes/Pain.tsx` | Tambah optional prop `pains?: string[]` dan `turn?: string` (default = copy lama → `Promo` aman) |
| `src/scenes/PriceAdapt.tsx` | BARU |
| `src/PromoResep.tsx` | BARU (mirror `Promo.tsx`, susunan scene di atas) |
| `src/Root.tsx` | Daftarkan composition `PromoResep` (900f, 30fps, 1080×1920) |
| `record.mjs` | Resep direkam diselaraskan dengan scene 4 |

Render: `npx remotion render src/index.ts PromoResep out/promo-resep.mp4 --concurrency=2`

---

## Out of Scope

- Format selain 9:16
- Voiceover / narasi suara
- Mengubah komposisi `Promo` lama
- Fitur baru di app TataData-Dapur (cuma merekam yang sudah ada)
