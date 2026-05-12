# Tutorial Page Design

**Date:** 2026-05-12

## Overview

Tambah halaman `/tutorial` berisi 3 video tutorial cara pakai aplikasi, dan dashboard banner dismissible sebagai pintu masuk ke halaman tersebut.

---

## Files

| File | Action |
|------|--------|
| `public/videos/panduan-login.mp4` | Copy dari `/home/gbk/Downloads/WhatsApp Video 2026-04-24 at 16.03.17.mp4` |
| `public/videos/panduan-bahan-baku-hpp.mp4` | Copy dari `/home/gbk/Downloads/WhatsApp Video 2026-05-03 at 10.15.17.mp4` |
| `public/videos/panduan-pembelian.mp4` | Copy dari `/home/gbk/Downloads/WhatsApp Video 2026-05-03 at 13.30.39.mp4` |
| `src/app/tutorial/page.tsx` | Baru |
| `src/components/ui/TutorialBanner.tsx` | Baru |
| `src/app/dashboard/page.tsx` | Edit — tambah `<TutorialBanner />` dan tombol kecil |

---

## TutorialBanner Component

**File:** `src/components/ui/TutorialBanner.tsx`

**Behavior:**
- Saat mount, cek `localStorage.getItem("tutorial_banner_dismissed")`
- Jika `null` (belum pernah dismiss): render banner gradient coklat
- Jika `"1"` (sudah dismiss): render tombol kecil saja

**Banner state (belum dismiss):**
- Background: `linear-gradient(135deg, #7C563D, #A05035)`
- Teks: "📹 Video Tutorial" + subtitle "Pelajari cara pakai aplikasi ini langkah demi langkah"
- Tombol "Lihat Tutorial →" → navigate ke `/tutorial`
- Tombol ✕ (pojok kanan) → set `localStorage("tutorial_banner_dismissed", "1")` → re-render ke state dismissed

**Small button state (sudah dismiss):**
- Render tombol kecil `📹 Tutorial` di sebelah kiri date picker di header dashboard
- Style: `bg-[#F5EFE0] border border-[#C4956A] text-[#7C563D]`, rounded, font-size sm
- Klik → navigate ke `/tutorial`

**Placement di dashboard:**
- Banner: di antara header tanggal dan summary grid (di atas 4 stat cards)
- Tombol kecil: di dalam row header tanggal, sebelah kiri date input

---

## Tutorial Page

**File:** `src/app/tutorial/page.tsx`

**Route:** `/tutorial`

**Layout:** Gunakan `AppLayout` dengan title "Tutorial"

**Structure:** 3 section vertikal berurutan

### Section 1
- Label: `LANGKAH 1`
- Judul: `Panduan Login dan Ganti Password`
- Video: `<video src="/videos/panduan-login.mp4" controls />`

### Section 2
- Label: `LANGKAH 2`
- Judul: `Panduan Pengelolaan Bahan Baku dan Membuat HPP Produk`
- Video: `<video src="/videos/panduan-bahan-baku-hpp.mp4" controls />`

### Section 3
- Label: `LANGKAH 3`
- Judul: `Menambahkan Pembelian Bahan Baku`
- Video: `<video src="/videos/panduan-pembelian.mp4" controls />`

**Video style:** `w-full rounded-lg`, `controls`, tidak autoplay

**Section style:** Tiap section dibungkus Card component, label uppercase kecil warna `#7C563D`, judul bold `#2C1810`, video di bawah judul dengan padding.

---

## Video Hosting

- Video di-copy ke `public/videos/` dan di-serve langsung oleh Next.js
- Total ukuran: ~3MB (login 1.1MB, bahan-baku 1.3MB, pembelian 0.7MB)
- Tidak perlu Supabase Storage

---

## localStorage Key

| Key | Value | Meaning |
|-----|-------|---------|
| `tutorial_banner_dismissed` | `"1"` | User sudah dismiss banner, tampilkan tombol kecil |

---

## Auth

Halaman `/tutorial` hanya bisa diakses setelah login — middleware existing sudah handle redirect ke `/login` jika belum auth, tidak perlu perubahan middleware.
