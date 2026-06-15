import type { ReactNode } from "react";

/**
 * Single source of truth for field-level help. Each entry holds a short blurb
 * (shown in the HelpTip popover) and an optional anchor that deep-links to the
 * fuller explanation in Pusat Bantuan (/help). Keep `short` to 1–3 sentences.
 */
export type HelpAnchor = { tab: "tour" | "faq" | "video"; id: string };
export type FieldHelp = { title: string; short: ReactNode; helpAnchor?: HelpAnchor };

export function helpHref(a: HelpAnchor): string {
  return `/help?tab=${a.tab}#${a.id}`;
}

export const FIELD_HELP: Record<string, FieldHelp> = {
  "recipe.batchYield": {
    title: "Hasil per Batch",
    short: (
      <>
        Jumlah pcs yang keluar dari sekali bikin resep ini. Misal 1 resep jadi 6 croissant → isi 6.
        App bagi total biaya resep ke 6 biar HPP per pcs-nya pas. Kalau sekali bikin cuma jadi 1, biarin 1.
      </>
    ),
    helpAnchor: { tab: "faq", id: "faq-0-0" },
  },
  "recipe.wastePct": {
    title: "Estimasi Waste (%)",
    short: (
      <>
        Persen bahan yang kebuang atau gagal waktu produksi. Ngisi ini bikin HPP per unit lebih akurat —
        dihitung dari yang benar-benar jadi, bukan yang seharusnya. Belum yakin angkanya? Isi 0 dulu.
      </>
    ),
    helpAnchor: { tab: "faq", id: "faq-0-3" },
  },
  "recipe.isIngredient": {
    title: "Bahan Setengah Jadi",
    short: (
      <>
        Produk yang diproses dulu, lalu dipakai jadi bahan di produk lain — kayak selai buat kue.
        Punya stok sendiri yang diatur lewat menu Produksi.
      </>
    ),
    helpAnchor: { tab: "faq", id: "faq-0-2" },
  },
  "recipe.isAddon": {
    title: "Add-On Penjualan",
    short: (
      <>
        Tandai kalau produk ini bisa jadi tambahan pas jual produk lain — topper, lilin, box khusus.
        Nanti bisa dipilih sebagai add-on di menu Penjualan.
      </>
    ),
    helpAnchor: { tab: "tour", id: "recipes" },
  },
  "item.isAddon": {
    title: "Add-On Penjualan",
    short: (
      <>
        Bahan kayak topper kue, lilin, atau kemasan khusus bisa ditandai add-on. Nanti bisa dipilih
        sebagai tambahan pas mencatat penjualan produk.
      </>
    ),
    helpAnchor: { tab: "tour", id: "items" },
  },
  "item.avgPrice": {
    title: "Harga Rata-rata (Avg Price)",
    short: (
      <>
        Dihitung otomatis dari riwayat pembelian pakai metode weighted average. Harga inilah yang dipakai
        buat ngitung HPP resep — nggak usah diisi manual.
      </>
    ),
    helpAnchor: { tab: "tour", id: "items" },
  },
  "sales.category": {
    title: "Kategori Penjualan",
    short: (
      <>
        Tandai channel tiap transaksi — Offline, GoFood, GrabFood, ShopeeFood, dan lainnya. Berguna buat
        analisis channel penjualan di Laporan.
      </>
    ),
    helpAnchor: { tab: "tour", id: "sales" },
  },
  "purchase.usePkg": {
    title: "Beli per Kemasan",
    short: (
      <>
        Centang kalau beli satuan kemasan (dus, karton, pack). App hitung harga per unit otomatis dari
        harga kemasan ÷ isi kemasan — hasilnya masuk ke Harga Rata-rata bahan.
      </>
    ),
    helpAnchor: { tab: "tour", id: "purchases" },
  },
  "purchase.sizePerPkg": {
    title: "Isi per Kemasan",
    short: (
      <>
        Berapa unit bahan dalam satu kemasan. Misal 1 karton = 1000 gr → isi 1000.
        App bagi harga kemasan dengan angka ini buat dapat harga per gr/ml/pcs.
      </>
    ),
    helpAnchor: { tab: "tour", id: "purchases" },
  },
  "produksi.totalCost": {
    title: "Total Biaya Produksi",
    short: (
      <>
        Diisi otomatis dari estimasi HPP × jumlah. Kalau biaya aktual beda (bahan mahal tiba-tiba,
        ada biaya tambahan), ganti manual — angka ini yang dipakai buat update HPP bahan setengah jadi.
      </>
    ),
    helpAnchor: { tab: "tour", id: "produksi" },
  },
};
