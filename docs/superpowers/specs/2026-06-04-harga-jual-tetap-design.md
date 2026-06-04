# Harga Jual Tetap (Fixed Selling Price)

**Date:** 2026-06-04  
**Status:** Approved

## Overview

Klien ingin sistem mengingat harga jual terakhir per produk sehingga saat catat penjualan, harga sudah auto-fill tanpa perlu input ulang. Fitur ini mencakup produk utama dan add-on, serta memberi indikator visual saat margin tergerus karena perubahan HPP.

---

## 1. Database

### Migration: tambah kolom `selling_price`

**Tabel `recipes`** (sudah ada — untuk produk utama + sub-recipe add-on):
```sql
ALTER TABLE recipes ADD COLUMN selling_price NUMERIC DEFAULT NULL;
```

**Tabel `items`** (untuk add-on item):
```sql
ALTER TABLE items ADD COLUMN selling_price NUMERIC DEFAULT NULL;
```

Kedua kolom nullable — nilai `NULL` berarti belum pernah dijual, tidak ada auto-fill.

---

## 2. Update Flow (saat sale disimpan)

Setiap kali `createSale` atau `updateSale` berhasil, lakukan update `selling_price` untuk semua harga yang dipakai:

- Tiap item dalam sale → `recipes.selling_price = selling_price` (harga base product)
- Tiap add-on dalam sale:
  - Kalau source type `item` → `items.selling_price = price_per_unit_at_sale`
  - Kalau source type `sr` (sub-recipe/finished recipe) → `recipes.selling_price = price_per_unit_at_sale`

Update dilakukan client-side via Supabase setelah sale berhasil disimpan (bukan di RPC), di dalam mutation `onSuccess` pada `useCreateSale` dan `useUpdateSale`. Gunakan `.update().eq('id', recipeId)` per item.

---

## 3. Sales Form Changes

### 3a. Auto-fill base product price

Di handler saat `recipeId` berubah (fungsi `updateItemField` atau tempat select recipe):
- Ambil `recipe.selling_price` dari data `useRecipes`
- Kalau tidak null → set `row.sellingPrice = String(recipe.selling_price)`
- Kalau null → biarkan kosong (user input manual seperti sekarang)

### 3b. Auto-fill add-on price

Di `selectAddonSource`:
- Kalau source type `item` → `pricePerUnit = item.selling_price ?? item.avg_price`
- Kalau source type `sr` → `pricePerUnit = sr.selling_price ?? sr.avg_price`

Fallback ke `avg_price` (HPP) kalau `selling_price` belum pernah di-set.

### 3c. Clear button (×)

Di input "Harga Jual per Unit":
- Tampilkan tombol `×` kecil (absolute positioned di kanan dalam input, atau icon button di sebelah field) **hanya kalau** `row.sellingPrice !== ""`
- Klik → `updateItemField(row._key, "sellingPrice", "")`

Di tiap addon row input harga:
- Tampilkan `×` kecil kalau `addon.pricePerUnit !== 0`
- Klik → set `pricePerUnit = 0`

### 3d. Live margin indicator

Di bawah input "Harga Jual per Unit" (berdampingan dengan teks "HPP Akhir/unit" yang sudah ada):

```
HPP Akhir/unit: Rp2.472   Margin: 38%
```

Kalkulasi: `margin = (sellingPrice - hppPerUnit) / sellingPrice * 100`

Warna teks margin:
- `≥ 30%` → hijau (`text-green-600`)
- `15–29%` → kuning (`text-yellow-600`)  
- `< 15%` atau negatif → merah (`text-red-500`)

Tidak tampil kalau `sellingPrice` kosong/0 atau `hppPerUnit === 0`.

---

## 4. Recipes Page — Margin Badge

Di list resep, untuk resep yang punya `selling_price` tidak null, tampilkan badge kecil di sebelah nama/HPP:

```
Kopi Susu   HPP Rp2.472   [Jual Rp4.000 · 38%] ← hijau
Matcha      HPP Rp2.203   [Jual Rp2.500 · 12%] ← kuning
Coklat      HPP Rp3.065   [Jual Rp3.000 · -2%] ← merah
```

Badge tidak tampil kalau `selling_price` null (belum pernah dijual).

Threshold warna sama: ≥30% hijau, 15–29% kuning, <15%/negatif merah.

---

## 5. Edge Cases

| Case | Behavior |
|------|----------|
| Resep baru, belum pernah dijual | `selling_price` null → input kosong, user input manual |
| HPP naik, margin jadi negatif | Badge merah di Recipes page + indikator merah di form |
| User override harga di form | Harga baru tersimpan ke DB setelah sale disimpan |
| Add-on baru belum pernah dijual | Fallback ke `avg_price` (HPP) seperti sekarang |
| Sale di-edit (updateSale) | `selling_price` tetap diupdate dengan harga edit terbaru |

---

## 6. Hook Query Changes

`useRecipes`, `useAddonSubRecipes`, `useAddonFinishedRecipes` — pastikan SELECT query include kolom `selling_price` dari tabel `recipes`.

`useAddonItems` — pastikan SELECT query include kolom `selling_price` dari tabel `items`.

---

## 7. Type Changes

`Recipe` interface tambah:
```typescript
selling_price?: number | null;
```

`Item` interface tambah:
```typescript
selling_price?: number | null;
```

---

## 8. Out of Scope

- Edit `selling_price` langsung dari Recipes page (bukan dari sales flow)
- Threshold margin yang bisa dikonfigurasi user
- History perubahan harga jual
