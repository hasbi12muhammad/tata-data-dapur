# PromoResep Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah komposisi Remotion baru `PromoResep` (30 detik, 9:16) yang menjual konsep "bikin resep → HPP nyesuain sendiri saat harga bahan naik", tanpa mengubah komposisi `Promo` lama.

**Architecture:** Reuse scene `Pain` (dengan copy baru lewat prop), `Intro`, `RecipeFlow` (rekaman app asli), dan `Outro`. Bangun satu scene React sintetik baru `PriceAdapt` sebagai puncak cerita. Rangkai semua di `PromoResep.tsx` memakai pola `Sequence` + `Fade` yang sudah ada di `Promo.tsx`, lalu daftarkan di `Root.tsx`.

**Tech Stack:** Remotion 4.0.290, React 18.3, TypeScript, lucide-react, puppeteer-core (rekaman), Chrome `/usr/bin/google-chrome`, ffmpeg.

## Global Constraints

- Canvas: 1080×1920 (9:16), 30 fps, 900 frame total — sama persis dengan `Promo`.
- Palet warna hanya dari `src/theme.ts` (objek `C`); format uang lewat helper `rupiah` dari `src/theme.ts`.
- Font hanya dari `src/fonts.ts` (`poppins`, `openSans`, `fraunces`).
- Copy tanpa em dash (—) atau en dash (–) — sudah lewat skill humanizer.
- Komposisi `Promo` lama TIDAK boleh berubah perilakunya (verifikasi: still frame sebelum/sesudah identik).
- Working dir semua perintah: `/home/hasbi/Proyek/TataData-Dapur/promo-video` kecuali ditulis lain.
- Kredensial demo (sudah hardcoded di `record.mjs`): `akun-demo@tatadata-dapur.com` / `hasbi123456`.
- Resep acuan = **Pancake Susu Cokelat** (resep yang dibangun `record.mjs`), supaya scene 3 (rekaman) dan scene 4 (sintetik) memakai resep yang sama.

### Data terkunci scene 4 (PriceAdapt)

Resep: **Pancake Susu Cokelat**, harga jual **Rp 17.000**.

| Bahan | Qty | Modal awal | Modal setelah naik |
|-------|-----|-----------|-------------------|
| Tepung | 50 gr | 600 | 600 |
| Susu UHT | 100 ml | 2.200 | **3.000** (naik 36%) |
| Telur | 1 butir | 2.500 | 2.500 |
| Topping Cokelat | 20 gr | 1.800 | 1.800 |
| Gas + Kemasan | 1 porsi | 1.400 | 1.400 |

- HPP awal = **Rp 8.500** → HPP baru = **Rp 9.300**
- Margin @Rp 17.000: **50% → 45%**
- Saran harga jual baru = **Rp 19.000** (margin balik ~51%)

---

## File Structure

| File | Tanggung jawab |
|------|----------------|
| `src/scenes/Pain.tsx` (modify) | Hook pain. Tambah optional prop `pains` & `turn`; default = copy lama. |
| `src/scenes/PriceAdapt.tsx` (create) | Scene baru: harga bahan naik → HPP & margin re-count → banner saran harga. |
| `src/PromoResep.tsx` (create) | Rangkaian 5 scene jadi video 900 frame. |
| `src/Root.tsx` (modify) | Daftarkan composition `PromoResep`. |
| `record.mjs` (no functional change) | Sudah membangun resep Pancake Susu Cokelat. Dipakai untuk re-record `recipe-flow.mp4`. |

---

## Task 1: Parametrize `Pain.tsx`

Buat scene Pain bisa menerima copy berbeda tanpa mengubah tampilan default (supaya `Promo` lama aman).

**Files:**
- Modify: `src/scenes/Pain.tsx`

**Interfaces:**
- Produces: `Pain` component menerima props `{ pains?: string[]; turn?: string }`. Tanpa props → copy lama. `Promo.tsx` memanggil `<Pain />` (tanpa argumen) dan harus tetap identik.

- [ ] **Step 1: Ubah konstanta jadi default prop**

Di `src/scenes/Pain.tsx`, ganti deklarasi komponen. `PAINS` lama jadi nilai default, dan baris "turn" yang sekarang hardcoded `"Ada cara yang lebih gampang."` jadi prop `turn` dengan default sama.

Ganti baris konstanta + signature:

```tsx
const DEFAULT_PAINS = [
  "Nentuin harga jual masih main feeling?",
  "Jualan rame, tapi untungnya kok tipis?",
  "Stok bahan abis pas lagi laku-lakunya?",
];
const DEFAULT_TURN = "Ada cara yang lebih gampang.";

export const Pain: React.FC<{ pains?: string[]; turn?: string }> = ({
  pains = DEFAULT_PAINS,
  turn = DEFAULT_TURN,
}) => {
```

Lalu di dalam JSX:
- Ganti `PAINS.map(...)` jadi `pains.map(...)`.
- Ganti teks hardcoded turn line (`Ada cara yang lebih gampang.`) jadi `{turn}`.

Hapus deklarasi `const PAINS = [...]` yang lama (digantikan `DEFAULT_PAINS`).

- [ ] **Step 2: Render still default Pain untuk pastikan tampilan lama tak berubah**

Run: `npx remotion still src/index.ts Promo out/check-pain-default.png --frame=110`
Expected: PASS render. Visual: 3 pain line lama + "Ada cara yang lebih gampang." + sparkle. Sama seperti sebelumnya.

- [ ] **Step 3: Render still Pain dengan copy custom (sanity)**

Sementara, tidak ada composition yang memakai props baru. Verifikasi cukup lewat TypeScript build:

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS, tanpa error tipe.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/Pain.tsx
git commit -m "feat(promo-video): make Pain scene copy configurable via props"
```

---

## Task 2: Scene baru `PriceAdapt.tsx`

Scene puncak: kartu resep Pancake Susu Cokelat, baris Susu UHT harganya naik, HPP & margin re-count, lalu banner saran harga jual.

**Files:**
- Create: `src/scenes/PriceAdapt.tsx`

**Interfaces:**
- Consumes: `C`, `rupiah` dari `../theme`; `poppins`, `openSans` dari `../fonts`; `AppBar`, `Card`, `Kicker`, `Caption`, `Pill` dari `../ui`; `Decor`, `Grain` dari `../decor`.
- Produces: `export const PriceAdapt: React.FC` (tanpa props wajib). Dipakai `PromoResep.tsx`.

- [ ] **Step 1: Tulis komponen lengkap**

Buat `src/scenes/PriceAdapt.tsx`:

```tsx
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import { TrendingUp } from "lucide-react";
import { C, rupiah } from "../theme";
import { poppins, openSans } from "../fonts";
import { AppBar, Card, Caption, Kicker } from "../ui";
import { Decor, Grain } from "../decor";

// Pancake Susu Cokelat — modal per porsi. Susu UHT yang naik harga.
const ROWS = [
  { name: "Tepung", qty: "50 gr", from: 600, to: 600 },
  { name: "Susu UHT", qty: "100 ml", from: 2200, to: 3000 },
  { name: "Telur", qty: "1 butir", from: 2500, to: 2500 },
  { name: "Topping Cokelat", qty: "20 gr", from: 1800, to: 1800 },
  { name: "Gas + Kemasan", qty: "1 porsi", from: 1400, to: 1400 },
];
const HPP_FROM = ROWS.reduce((a, r) => a + r.from, 0); // 8500
const HPP_TO = ROWS.reduce((a, r) => a + r.to, 0); // 9300
const PRICE = 17000;
const SUGGEST = 19000;
const NAIK_PCT = Math.round(((3000 - 2200) / 2200) * 100); // 36

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const PriceAdapt: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardIn = spring({ frame, fps, config: { damping: 16 } });
  const cardY = interpolate(cardIn, [0, 1], [70, 0]);

  // price spike on Susu UHT: frame 40..80
  const priceT = interpolate(frame, [40, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const susuNow = lerp(2200, 3000, priceT);
  const susuFlash = interpolate(frame, [40, 60, 100], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // HPP re-count: frame 80..140
  const hppT = interpolate(frame, [80, 140], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const hppNow = lerp(HPP_FROM, HPP_TO, hppT);
  const hppGlow = interpolate(frame, [80, 110, 150], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // margin: frame 120..170 (50% -> 45%)
  const marginT = interpolate(frame, [120, 170], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const marginNow = lerp(
    ((PRICE - HPP_FROM) / PRICE) * 100,
    ((PRICE - HPP_TO) / PRICE) * 100,
    marginT
  );
  // verde -> amber as margin drops
  const marginColor = marginT < 0.5 ? C.verde : "#b8860b";

  // suggestion banner: slide up frame 170..210
  const bannerIn = spring({
    frame: Math.max(0, frame - 170),
    fps,
    config: { damping: 15 },
  });

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Decor seed={1} />
      <AppBar title="Pancake Susu Cokelat" Icon={TrendingUp} kicker="Harga bahan baru" />

      <div style={{ padding: "36px 48px", transform: `translateY(${cardY}px)` }}>
        <Card>
          <div style={{ marginBottom: 18 }}>
            <Kicker color={C.dune}>Bahan per porsi</Kicker>
          </div>

          {ROWS.map((r, i) => {
            const isSusu = r.name === "Susu UHT";
            const shownCost = isSusu ? susuNow : r.from;
            return (
              <div
                key={r.name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "20px 18px",
                  margin: "0 -18px",
                  borderBottom: `2px solid ${C.border}`,
                  borderRadius: 16,
                  background: isSusu
                    ? `rgba(160,80,53,${0.14 * susuFlash})`
                    : "transparent",
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: openSans,
                      fontWeight: 600,
                      fontSize: 36,
                      color: C.fg,
                    }}
                  >
                    {r.name}
                  </div>
                  <div style={{ fontFamily: openSans, fontSize: 27, color: C.muted }}>
                    {r.qty}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  {isSusu && priceT > 0.05 && (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        background: C.dune,
                        color: "#fff",
                        fontFamily: poppins,
                        fontWeight: 700,
                        fontSize: 26,
                        padding: "8px 18px",
                        borderRadius: 999,
                        opacity: priceT,
                      }}
                    >
                      <TrendingUp size={26} color="#fff" strokeWidth={2.6} />
                      naik {NAIK_PCT}%
                    </div>
                  )}
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontWeight: 600,
                      fontSize: 34,
                      color: isSusu && priceT > 0.5 ? C.dune : C.casa,
                    }}
                  >
                    {rupiah(shownCost)}
                  </div>
                </div>
              </div>
            );
          })}
        </Card>

        {/* HPP + margin result */}
        <div style={{ marginTop: 36 }}>
          <Card
            style={{
              background: C.casa,
              border: "none",
              display: "flex",
              flexDirection: "column",
              gap: 24,
              boxShadow: `0 24px 60px rgba(44,24,16,${0.12 + hppGlow * 0.28})`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontFamily: poppins,
                  fontWeight: 600,
                  fontSize: 40,
                  color: C.gold,
                }}
              >
                HPP per porsi
              </div>
              <div
                style={{
                  fontFamily: poppins,
                  fontWeight: 700,
                  fontSize: 72,
                  color: "#fff",
                }}
              >
                {rupiah(hppNow)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              <div
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.12)",
                  borderRadius: 22,
                  padding: "26px 30px",
                }}
              >
                <div style={{ fontFamily: openSans, fontSize: 28, color: C.gold }}>
                  Harga Jual
                </div>
                <div
                  style={{
                    fontFamily: poppins,
                    fontWeight: 700,
                    fontSize: 46,
                    color: "#fff",
                  }}
                >
                  {rupiah(PRICE)}
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  background: marginColor,
                  borderRadius: 22,
                  padding: "26px 30px",
                }}
              >
                <div style={{ fontFamily: openSans, fontSize: 28, color: "#eef" }}>
                  Margin
                </div>
                <div
                  style={{
                    fontFamily: poppins,
                    fontWeight: 700,
                    fontSize: 46,
                    color: "#fff",
                  }}
                >
                  {marginNow.toFixed(0)}%
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* suggestion banner */}
        <div
          style={{
            marginTop: 30,
            opacity: bannerIn,
            transform: `translateY(${interpolate(bannerIn, [0, 1], [50, 0])}px)`,
          }}
        >
          <div
            style={{
              background: C.dune,
              borderRadius: 26,
              padding: "30px 36px",
              boxShadow: "0 16px 40px rgba(44,24,16,0.28)",
            }}
          >
            <div
              style={{
                fontFamily: openSans,
                fontWeight: 700,
                fontSize: 40,
                lineHeight: 1.3,
                color: "#fff",
              }}
            >
              Naikin harga ke {rupiah(SUGGEST)}, untungmu balik kayak semula.
            </div>
          </div>
        </div>
      </div>

      <Caption>
        Harga bahan berubah, HPP sama saran harganya ikut nyesuain sendiri.
      </Caption>
      <Grain />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Daftarkan composition sementara untuk verifikasi visual**

Tambahkan SEMENTARA di `src/Root.tsx` (akan diganti `PromoResep` di Task 3). Di dalam fragment, tambah setelah `<Composition id="Promo" .../>`:

```tsx
import { PriceAdapt } from "./scenes/PriceAdapt";
// ...
<Composition
  id="PriceAdaptTest"
  component={PriceAdapt}
  durationInFrames={290}
  fps={30}
  width={1080}
  height={1920}
/>
```

- [ ] **Step 3: Render still di 4 fase untuk cek animasi**

```bash
npx remotion still src/index.ts PriceAdaptTest out/pa-30.png --frame=30
npx remotion still src/index.ts PriceAdaptTest out/pa-90.png --frame=90
npx remotion still src/index.ts PriceAdaptTest out/pa-150.png --frame=150
npx remotion still src/index.ts PriceAdaptTest out/pa-220.png --frame=220
```

Expected (buka tiap PNG):
- `pa-30`: kartu bahan tampil, Susu UHT = Rp 2.200, belum ada badge.
- `pa-90`: Susu UHT mulai/НselesaiNaik ke ~Rp 3.000, badge "naik 36%" muncul, HPP mulai naik.
- `pa-150`: HPP = Rp 9.300, margin sedang turun ke 45% (kartu margin amber).
- `pa-220`: banner "Naikin harga ke Rp 19.000..." tampil penuh.

- [ ] **Step 4: Hapus composition test**

Hapus blok `PriceAdaptTest` dari `src/Root.tsx` (import `PriceAdapt` boleh tetap kalau Task 3 memakainya; kalau tidak, hapus juga). Pastikan build bersih:

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/PriceAdapt.tsx
git commit -m "feat(promo-video): add PriceAdapt scene (harga bahan naik -> HPP & margin update)"
```

---

## Task 3: Komposisi `PromoResep.tsx` + daftar di `Root.tsx`

**Files:**
- Create: `src/PromoResep.tsx`
- Modify: `src/Root.tsx`

**Interfaces:**
- Consumes: `Pain` (props `pains`, `turn`), `Intro`, `RecipeFlow` (props `kicker`, `caption`, `callout`, `calloutFrame`), `PriceAdapt`, `Outro`.
- Produces: `export const PromoResep: React.FC`, composition id `"PromoResep"` (900f, 30fps, 1080×1920).

- [ ] **Step 1: Buat `src/PromoResep.tsx`**

```tsx
import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { C } from "./theme";
import { Pain } from "./scenes/Pain";
import { Intro } from "./scenes/Intro";
import { RecipeFlow } from "./scenes/RecipeFlow";
import { PriceAdapt } from "./scenes/PriceAdapt";
import { Outro } from "./scenes/Outro";

const Fade: React.FC<{
  dur: number;
  inOnly?: boolean;
  out?: boolean;
  children: React.ReactNode;
}> = ({ dur, inOnly, out, children }) => {
  const f = useCurrentFrame();
  let op = 1;
  if (inOnly) {
    op = interpolate(f, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  } else if (out) {
    op = interpolate(f, [dur - 14, dur], [1, 0], { extrapolateLeft: "clamp" });
  }
  return <AbsoluteFill style={{ opacity: op }}>{children}</AbsoluteFill>;
};

const PAINS = [
  "Harga bahan naik terus, harga jualmu masih segitu?",
  "Jualan laris, tapi untungnya kok mepet?",
  "Tiap bahan naik, mesti ngitung ulang dari nol?",
];

export const PromoResep: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {/* Pain 0–120 */}
      <Sequence from={0} durationInFrames={120}>
        <Fade dur={120} inOnly>
          <Pain pains={PAINS} turn="Tenang, ada cara gampangnya." />
        </Fade>
      </Sequence>

      {/* Intro 120–210 */}
      <Sequence from={120} durationInFrames={90}>
        <Fade dur={90}>
          <Intro />
        </Fade>
      </Sequence>

      {/* RecipeFlow (rekaman app asli) 210–480 */}
      <Sequence from={210} durationInFrames={270}>
        <Fade dur={270}>
          <RecipeFlow
            kicker="Hitung HPP"
            caption="Masukin bahannya, modal per porsi langsung muncul."
            callout="ngitung sendiri"
            calloutFrame={200}
          />
        </Fade>
      </Sequence>

      {/* PriceAdapt 480–770 */}
      <Sequence from={480} durationInFrames={290}>
        <Fade dur={290}>
          <PriceAdapt />
        </Fade>
      </Sequence>

      {/* Outro 770–900 */}
      <Sequence from={770} durationInFrames={130}>
        <Fade dur={130} out>
          <Outro />
        </Fade>
      </Sequence>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Daftarkan di `src/Root.tsx`**

Di `src/Root.tsx`, tambahkan import dan composition kedua (jangan hapus `Promo`):

```tsx
import { Composition } from "remotion";
import { Promo } from "./Promo";
import { PromoResep } from "./PromoResep";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Promo"
        component={Promo}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="PromoResep"
        component={PromoResep}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
```

- [ ] **Step 3: Build check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 4: Render still di tiap batas scene**

```bash
npx remotion still src/index.ts PromoResep out/pr-060.png --frame=60
npx remotion still src/index.ts PromoResep out/pr-160.png --frame=160
npx remotion still src/index.ts PromoResep out/pr-350.png --frame=350
npx remotion still src/index.ts PromoResep out/pr-650.png --frame=650
npx remotion still src/index.ts PromoResep out/pr-850.png --frame=850
```

Expected:
- `pr-060`: Pain dengan 3 copy baru ("Harga bahan naik terus...").
- `pr-160`: Intro (logo + "Tata Data Dapur").
- `pr-350`: RecipeFlow (frame device berisi rekaman) + caption baru.
- `pr-650`: PriceAdapt (frame lokal ~170) — HPP/margin sudah update.
- `pr-850`: Outro ("Coba Sekarang").

- [ ] **Step 5: Commit**

```bash
git add src/PromoResep.tsx src/Root.tsx
git commit -m "feat(promo-video): assemble PromoResep composition and register it"
```

---

## Task 4: Re-record `recipe-flow.mp4` (rekaman app asli)

Re-record flow bikin resep dari app TataData-Dapur. Jika app tidak bisa dijalankan saat ini, `recipe-flow.mp4` yang lama (resep Pancake Susu Cokelat yang sama) dipakai sebagai fallback — desain tetap valid.

**Files:**
- Regenerate: `public/shots/recipe-flow.mp4` (lewat `frames/` + ffmpeg)

- [ ] **Step 1: Jalankan dev server app TataData-Dapur**

Di terminal terpisah:

```bash
cd /home/hasbi/Proyek/TataData-Dapur && npm run dev
```

Tunggu sampai `http://localhost:3000` siap (cek: `curl -sf http://localhost:3000/login >/dev/null && echo UP`).
Jika server tidak bisa jalan / `npm run dev` bukan script-nya, lewati ke Step 5 (fallback).

- [ ] **Step 2: Rekam frame**

Di `/home/hasbi/Proyek/TataData-Dapur/promo-video`:

```bash
node record.mjs
```

Expected: log `frames: <N> realtime: <detik>s`, folder `frames/` terisi `f0000.jpg…` + `list.txt`. Tidak ada error login (kredensial sudah benar di `record.mjs`).

- [ ] **Step 3: Rakit jadi mp4**

```bash
ffmpeg -y -f concat -safe 0 -i frames/list.txt -vsync vfr -pix_fmt yuv420p -movflags +faststart public/shots/recipe-flow.mp4
```

Expected: `public/shots/recipe-flow.mp4` ter-update. Cek durasi: `ffprobe -v error -show_entries format=duration -of csv=p=0 public/shots/recipe-flow.mp4` → sekitar 8–12 detik.

- [ ] **Step 4: Verifikasi di video**

```bash
npx remotion still src/index.ts PromoResep out/pr-recipe.png --frame=330
```

Expected: dalam frame device terlihat modal resep app (sedang isi bahan / HPP). Lanjut ke Step 6.

- [ ] **Step 5: (Fallback) pakai rekaman lama**

Jika Step 1–3 gagal: pastikan `public/shots/recipe-flow.mp4` lama masih ada (`git status` harus bersih untuk file itu). Tidak ada perubahan file. Catat di commit Task 5 bahwa rekaman lama dipakai.

- [ ] **Step 6: Commit (hanya jika mp4 berubah)**

```bash
git add public/shots/recipe-flow.mp4
git commit -m "chore(promo-video): re-record recipe-flow.mp4 for PromoResep"
```

Jika fallback (mp4 tidak berubah), lewati commit ini.

---

## Task 5: Render final + review

**Files:**
- Produce: `out/promo-resep.mp4`

- [ ] **Step 1: Render penuh**

```bash
npx remotion render src/index.ts PromoResep out/promo-resep.mp4 --concurrency=2
```

Expected: selesai tanpa error, `out/promo-resep.mp4` ada, durasi ~30 detik (`ffprobe -v error -show_entries format=duration -of csv=p=0 out/promo-resep.mp4` → ~30.0).

- [ ] **Step 2: Pastikan `Promo` lama masih utuh**

```bash
npx remotion still src/index.ts Promo out/promo-old-110.png --frame=110
```

Expected: identik dengan tampilan Pain lama (copy default, bukan copy baru). Membuktikan komposisi lama tak terpengaruh.

- [ ] **Step 3: Tonton hasil**

Buka `out/promo-resep.mp4`. Checklist:
- Pain → Intro → RecipeFlow → PriceAdapt → Outro mengalir mulus (fade antar-scene).
- Scene PriceAdapt: Susu UHT naik, HPP 8.500 → 9.300, margin 50% → 45%, banner Rp 19.000 muncul.
- Tidak ada teks yang kepotong / nabrak.

- [ ] **Step 4: Commit artefak rencana (opsional) + selesai**

```bash
git add -A
git commit -m "chore(promo-video): render PromoResep final output"
```

---

## Self-Review Notes

- Spec coverage: Pain (T1), PriceAdapt + data terkunci (T2), rangkaian + Root (T3), rekaman app asli (T4), render + proteksi Promo lama (T5). Semua section spec tercakup.
- Penyesuaian dari spec: resep acuan diganti dari "Nasi Ayam Geprek" ke "Pancake Susu Cokelat" (resep yang memang dibangun `record.mjs`) agar scene 3 dan 4 konsisten tanpa bergantung data live. Angka HPP 8.500 → 9.300, margin 50% → 45%, saran Rp 19.000 sudah dikunci dan konsisten di T2.
- Em dash: semua copy bebas em/en dash.
- Promo lama: hanya `Pain.tsx` yang berubah, dengan default = copy lama; T5 Step 2 memverifikasi.
