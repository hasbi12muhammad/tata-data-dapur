# Tutorial Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah halaman `/tutorial` dengan 3 video tutorial, dan dashboard banner dismissible sebagai pintu masuknya.

**Architecture:** `TutorialBanner` component menyimpan dismissed state di localStorage — saat belum dismiss render banner gradient, saat sudah dismiss render tombol kecil. Keduanya di-render di posisi yang sama (antara header tanggal dan stat grid di dashboard). Halaman `/tutorial` render 3 video HTML5 native dalam Card component.

**Tech Stack:** Next.js App Router, React (`useState`, `useEffect`), Tailwind CSS, localStorage, native HTML5 `<video>`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `public/videos/panduan-login.mp4` | Create (copy) | Video tutorial login |
| `public/videos/panduan-bahan-baku-hpp.mp4` | Create (copy) | Video tutorial bahan baku & HPP |
| `public/videos/panduan-pembelian.mp4` | Create (copy) | Video tutorial pembelian |
| `src/components/ui/TutorialBanner.tsx` | Create | Banner dismissible + small button state |
| `src/app/tutorial/page.tsx` | Create | Halaman tutorial dengan 3 video section |
| `src/app/dashboard/page.tsx` | Modify | Tambah `<TutorialBanner />` antara header dan stat grid |

---

## Task 1: Copy Video Files

**Files:**
- Create: `public/videos/panduan-login.mp4`
- Create: `public/videos/panduan-bahan-baku-hpp.mp4`
- Create: `public/videos/panduan-pembelian.mp4`

- [ ] **Step 1: Buat folder dan copy video**

```bash
mkdir -p public/videos
cp '/home/gbk/Downloads/WhatsApp Video 2026-04-24 at 16.03.17.mp4' public/videos/panduan-login.mp4
cp '/home/gbk/Downloads/WhatsApp Video 2026-05-03 at 10.15.17.mp4' public/videos/panduan-bahan-baku-hpp.mp4
cp '/home/gbk/Downloads/WhatsApp Video 2026-05-03 at 13.30.39.mp4' public/videos/panduan-pembelian.mp4
```

- [ ] **Step 2: Verifikasi**

```bash
ls -lh public/videos/
```

Expected output:
```
panduan-bahan-baku-hpp.mp4  1.3M
panduan-login.mp4           1.1M
panduan-pembelian.mp4       729K
```

- [ ] **Step 3: Commit**

```bash
git add public/videos/
git commit -m "feat: add tutorial video files"
```

---

## Task 2: TutorialBanner Component

**Files:**
- Create: `src/components/ui/TutorialBanner.tsx`

- [ ] **Step 1: Buat file komponen**

Buat `src/components/ui/TutorialBanner.tsx` dengan isi:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

const DISMISSED_KEY = "tutorial_banner_dismissed";

export function TutorialBanner() {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  // null = belum tahu (hydration guard, hindari flicker)
  if (dismissed === null) return null;

  if (dismissed) {
    return (
      <div className="flex mb-5">
        <Link
          href="/tutorial"
          className="flex items-center gap-1.5 bg-[#F5EFE0] border border-[#C4956A] text-[#7C563D] text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#EDE4CF] transition-colors"
        >
          📹 Tutorial
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 bg-gradient-to-r from-[#7C563D] to-[#A05035] text-white rounded-xl px-4 py-3 mb-5">
      <div>
        <p className="font-bold text-sm">📹 Video Tutorial</p>
        <p className="text-xs text-white/80 mt-0.5">
          Pelajari cara pakai aplikasi ini langkah demi langkah
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/tutorial"
          className="bg-white text-[#7C563D] text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#E9DFC6] transition-colors whitespace-nowrap"
        >
          Lihat Tutorial →
        </Link>
        <button
          onClick={dismiss}
          aria-label="Tutup banner tutorial"
          className="bg-white/20 hover:bg-white/30 rounded-lg p-1.5 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/TutorialBanner.tsx
git commit -m "feat: add TutorialBanner component with localStorage dismiss"
```

---

## Task 3: Integrasi TutorialBanner ke Dashboard

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Tambah import TutorialBanner**

Di `src/app/dashboard/page.tsx`, tambah import setelah import-import yang sudah ada:

```tsx
import { TutorialBanner } from "@/components/ui/TutorialBanner";
```

- [ ] **Step 2: Render TutorialBanner di atas summary grid**

Di dalam `return (`, cari bagian ini (sekitar baris 151):

```tsx
      {/* Summary grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
```

Tambahkan `<TutorialBanner />` tepat sebelumnya:

```tsx
      <TutorialBanner />

      {/* Summary grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
```

- [ ] **Step 3: Verifikasi manual**

Jalankan dev server:
```bash
npm run dev
```

Buka `http://localhost:3000/dashboard`. Pastikan:
- Banner gradient coklat muncul di atas stat cards
- Klik "Lihat Tutorial →" → navigasi ke `/tutorial` (halaman belum ada, 404 oke untuk sekarang)
- Klik ✕ → banner hilang, muncul tombol kecil `📹 Tutorial`
- Refresh halaman → tombol kecil tetap muncul (localStorage persisten)
- Buka DevTools → Application → Local Storage → ada key `tutorial_banner_dismissed: "1"`

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: integrate TutorialBanner into dashboard"
```

---

## Task 4: Halaman Tutorial

**Files:**
- Create: `src/app/tutorial/page.tsx`

- [ ] **Step 1: Buat file halaman**

Buat `src/app/tutorial/page.tsx` dengan isi:

```tsx
"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

const TUTORIALS = [
  {
    step: "LANGKAH 1",
    title: "Panduan Login dan Ganti Password",
    src: "/videos/panduan-login.mp4",
  },
  {
    step: "LANGKAH 2",
    title: "Panduan Pengelolaan Bahan Baku dan Membuat HPP Produk",
    src: "/videos/panduan-bahan-baku-hpp.mp4",
  },
  {
    step: "LANGKAH 3",
    title: "Menambahkan Pembelian Bahan Baku",
    src: "/videos/panduan-pembelian.mp4",
  },
];

export default function TutorialPage() {
  return (
    <AppLayout title="Tutorial">
      <div className="space-y-6">
        {TUTORIALS.map(({ step, title, src }) => (
          <Card key={step}>
            <CardHeader>
              <p className="text-xs font-bold text-[#7C563D] uppercase tracking-wide mb-1">
                {step}
              </p>
              <h3 className="text-sm font-semibold text-[#2C1810]">{title}</h3>
            </CardHeader>
            <CardBody>
              <video src={src} controls className="w-full rounded-lg" />
            </CardBody>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
```

- [ ] **Step 2: Verifikasi manual**

Buka `http://localhost:3000/tutorial`. Pastikan:
- Tampil 3 Card berurutan dengan label LANGKAH 1/2/3
- Setiap card punya judul dan video player
- Video bisa diputar (play button, controls muncul)
- Warna label coklat `#7C563D`, judul gelap `#2C1810`
- Di mobile: video full width, tidak overflow

- [ ] **Step 3: Commit**

```bash
git add src/app/tutorial/page.tsx
git commit -m "feat: add tutorial page with 3 video sections"
```

---

## Checklist Akhir

- [ ] `public/videos/` berisi 3 file MP4
- [ ] Dashboard menampilkan banner gradient di atas stat cards
- [ ] Klik ✕ → banner hilang, tombol kecil muncul, persisten setelah refresh
- [ ] Klik "Lihat Tutorial" (banner atau tombol kecil) → masuk `/tutorial`
- [ ] Halaman `/tutorial` menampilkan 3 video dengan judul dan label langkah
- [ ] Semua video bisa diputar
- [ ] Tampilan rapi di mobile dan desktop
