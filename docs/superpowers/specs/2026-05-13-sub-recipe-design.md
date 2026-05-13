# Sub-Recipe (Bahan Setengah Jadi) — Design Spec

**Date:** 2026-05-13  
**Status:** Approved

## Overview

Fitur ini memungkinkan sebuah resep dijadikan bahan baku untuk resep lain. Resep yang ditandai `is_ingredient` berperilaku seperti item biasa: punya stok, punya unit, dan dapat dipakai sebagai ingredient di resep lain. Stok bertambah saat "produksi" dicatat di halaman Pembelian, dan berkurang otomatis saat produk induk terjual.

---

## Database Schema

### Perubahan tabel `recipes`

```sql
ALTER TABLE recipes ADD COLUMN is_ingredient boolean NOT NULL DEFAULT false;
ALTER TABLE recipes ADD COLUMN unit text CHECK (unit IN ('gr','ml','pcs','kg','liter'));
ALTER TABLE recipes ADD COLUMN stock numeric(15,4) NOT NULL DEFAULT 0;
ALTER TABLE recipes ADD COLUMN avg_price numeric(15,4) NOT NULL DEFAULT 0;
```

- `is_ingredient`: flag apakah resep ini bisa dipakai sebagai bahan baku
- `unit`: satuan produk setengah jadi (wajib diisi jika `is_ingredient = true`)
- `stock`: stok saat ini (unit sesuai `unit`)
- `avg_price`: weighted average biaya produksi aktual (diupdate tiap produksi)

### Perubahan tabel `recipe_items`

```sql
ALTER TABLE recipe_items ADD COLUMN sub_recipe_id uuid REFERENCES recipes(id) ON DELETE RESTRICT;
ALTER TABLE recipe_items ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE recipe_items ADD CONSTRAINT one_ingredient_source
  CHECK ((item_id IS NOT NULL) != (sub_recipe_id IS NOT NULL));
ALTER TABLE recipe_items ADD CONSTRAINT no_self_reference
  CHECK (sub_recipe_id != recipe_id);
```

- Tepat salah satu dari `item_id` atau `sub_recipe_id` harus diisi per baris
- `ON DELETE RESTRICT` mencegah penghapusan sub-resep yang masih dipakai

### RPC baru: `produce_sub_recipe`

Dipanggil saat user mencatat produksi sub-resep di halaman Pembelian.

```sql
CREATE OR REPLACE FUNCTION produce_sub_recipe(
  p_user_id       uuid,
  p_recipe_id     uuid,
  p_batches       numeric,   -- jumlah batch yang diproduksi
  p_total_cost    numeric,   -- total biaya aktual (untuk weighted avg)
  p_created_at    timestamptz DEFAULT NULL
) RETURNS void ...
```

Efek:
1. Tambah `stock` sub-resep sebesar `p_batches`
2. Update `avg_price` sub-resep (weighted average)
3. Kurangi stok setiap bahan baku sesuai `recipe_items × p_batches`
4. Insert baris ke tabel `productions` (log produksi, tabel baru)

### Tabel baru: `productions`

```sql
CREATE TABLE productions (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id   uuid NOT NULL REFERENCES recipes(id) ON DELETE RESTRICT,
  batches     numeric(15,4) NOT NULL CHECK (batches > 0),
  total_cost  numeric(15,2) NOT NULL CHECK (total_cost >= 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

### Update `useCreateSale` (client-side)

Tidak ada RPC untuk penjualan — sales diinsert langsung dari client. Setelah insert berhasil, `useCreateSale` akan loop semua `recipe_items` yang punya `sub_recipe_id` dan kurangi stoknya:

```ts
// Setelah insert sale berhasil:
for (const ri of recipeItems.filter(r => r.sub_recipe_id)) {
  await supabase.rpc('deduct_sub_recipe_stock', {
    p_recipe_id: ri.sub_recipe_id,
    p_quantity: ri.quantity_used * p.quantity_sold,
    p_user_id: user.id,
  });
}
```

Atau langsung update jika tidak perlu RPC:
```ts
await supabase
  .from('recipes')
  .update({ stock: supabase.rpc('greatest', [0, stock - deduct]) })
  ...
```

Rekomendasi: buat RPC kecil `deduct_sub_recipe_stock` untuk atomicity.

---

## Frontend — Perubahan per Halaman

### Halaman Produk (`/recipes`)

**Form tambah/edit resep:**
- Tambah checkbox **"Jadikan Bahan Baku"** (`is_ingredient`)
- Jika dicentang → muncul dropdown pilih unit (gr / ml / pcs / kg / liter)
- Badge kecil di card resep jika `is_ingredient = true`

**Form tambah ingredient (BOM):**
- Dropdown ingredient tampilkan dua section:
  - `── Bahan Baku ──` (items biasa)
  - `── Produk Setengah Jadi ──` (resep dengan `is_ingredient = true`)
- Validasi client-side: tidak bisa pilih dirinya sendiri; tidak bisa pilih resep yang sudah menggunakan resep induk ini (circular)
- Quantity dan unit mengikuti unit sub-resep yang dipilih

**HPP Calculation (`calcHPP`):**

```ts
function calcHPP(items: RecipeItem[], usePrev: boolean): number {
  return items.reduce((sum, ri) => {
    if (ri.sub_recipe_id) {
      // sub-resep: gunakan HPP rekursif dari ingredient-nya
      const subRecipe = ri.sub_recipe as any;
      const subHPP = calcHPP(subRecipe?.recipe_items ?? [], usePrev);
      return sum + subHPP * ri.quantity_used;
    }
    const item = ri.item as any;
    const price = usePrev
      ? (item?.prev_avg_price || item?.avg_price || 0)
      : (item?.avg_price ?? 0);
    return sum + price * ri.quantity_used;
  }, 0);
}
```

**`useRecipes` query diperluas:**

```
recipes
  → recipe_items
      → item: items(name, unit, avg_price, prev_avg_price)
      → sub_recipe: recipes(name, unit, stock,
            recipe_items(quantity_used,
              item: items(name, unit, avg_price, prev_avg_price)))
```

### Halaman Pembelian (`/purchases`)

**Dropdown bahan:**
- Tampilkan items biasa + resep `is_ingredient = true` (dibedakan dengan section header atau badge)

**Jika sub-resep dipilih:**
- Label berubah: "Produksi" (bukan "Pembelian")
- Field "Total Harga" → total biaya bahan yang dikeluarkan
- Field "Jumlah" → jumlah batch yang diproduksi (dalam unit sub-resep)
- Preview: "HPP per unit: Rp X" (live dari HPP sub-resep saat ini)
- Submit → panggil `produce_sub_recipe` (bukan `record_purchase`)

**List purchases:**
- Produksi sub-resep muncul di list dengan label/badge "Produksi" untuk membedakan dari pembelian biasa

### Halaman Penjualan (`/sales`)

Tidak ada perubahan UI. Perubahan di `useCreateSale`:
- Setelah insert sale berhasil, loop `recipe_items` dari resep yang dijual
- Untuk setiap item yang punya `sub_recipe_id`: panggil RPC `deduct_sub_recipe_stock` dengan `quantity_used × quantity_sold`
- Invalidate query `["recipes"]` agar stok sub-resep terupdate di UI

### Dashboard & Reports

- HPP otomatis benar karena kalkulasi live dan rekursif
- Stok sub-resep bisa ditampilkan di laporan stok jika ada

---

## TypeScript Types

```ts
interface Recipe {
  // existing fields...
  is_ingredient: boolean;
  unit?: 'gr' | 'ml' | 'pcs' | 'kg' | 'liter';
  stock: number;
  avg_price: number;
}

interface RecipeItem {
  // existing fields...
  item_id?: string;        // nullable jika sub_recipe_id diisi
  sub_recipe_id?: string;
  sub_recipe?: Recipe;     // join result
}

interface Production {
  id: string;
  user_id: string;
  recipe_id: string;
  batches: number;
  total_cost: number;
  created_at: string;
  recipe?: Recipe;
}
```

---

## Edge Cases

| Kasus | Penanganan |
|---|---|
| Circular reference (A→B→A) | Validasi client-side saat pilih ingredient; disable opsi yang akan membuat circular |
| Stok sub-resep minus | Diizinkan (sama dengan item biasa); tidak memblok penjualan |
| Hapus sub-resep yang masih dipakai | Diblok oleh `ON DELETE RESTRICT` di FK |
| Edit unit setelah ada stok | Disabled di UI jika `stock > 0` atau sudah ada produksi |
| `hpp_at_sale` | Di-snapshot rekursif saat penjualan; sudah include HPP sub-resep |

---

## Migration Files

```
supabase/migrations/006_sub_recipe.sql          -- schema changes + RPC produce_sub_recipe + deduct_sub_recipe_stock
```
