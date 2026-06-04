# Harga Jual Tetap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simpan harga jual terakhir per produk dan add-on, auto-fill saat catat penjualan, tampilkan margin live di form dan badge margin di halaman Resep.

**Architecture:** Tambah kolom `selling_price` ke tabel `recipes` dan `items`. Setiap kali sale disimpan, update `selling_price` per resep/item yang dijual (best-effort). Saat user pilih produk di form penjualan, auto-fill dari `selling_price`. Queries sudah pakai `select("*")` jadi tidak butuh perubahan query.

**Tech Stack:** Next.js App Router, Supabase, TanStack Query, Tailwind, lucide-react

---

## File Map

| File | Action | Tanggung jawab |
|------|--------|----------------|
| `supabase/migrations/018_selling_price.sql` | Create | Tambah kolom `selling_price` ke `recipes` dan `items` |
| `src/types/index.ts` | Modify | Tambah field `selling_price?: number \| null` ke `Recipe` dan `Item` |
| `src/hooks/useSales.ts` | Modify | Persist selling prices setelah create/update sale |
| `src/app/sales/page.tsx` | Modify | selectRecipe auto-fill, updateAddonPrice, × clear button, margin indicator, addon price input |
| `src/app/recipes/page.tsx` | Modify | Margin badge per resep |

---

### Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/018_selling_price.sql`

- [ ] **Step 1: Buat file migration**

```sql
-- Add selling_price to recipes and items
-- Nullable: NULL = belum pernah dijual, tidak ada auto-fill
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS selling_price NUMERIC DEFAULT NULL;
ALTER TABLE items    ADD COLUMN IF NOT EXISTS selling_price NUMERIC DEFAULT NULL;
```

- [ ] **Step 2: Apply ke Supabase**

Jalankan via Supabase dashboard SQL editor, atau:
```bash
npx supabase db push
```
Verifikasi: cek tabel `recipes` dan `items` punya kolom `selling_price`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/018_selling_price.sql
git commit -m "feat: add selling_price column to recipes and items"
```

---

### Task 2: TypeScript Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Tambah `selling_price` ke interface `Recipe`**

Cari block `export interface Recipe {` (sekitar baris 43). Tambah field setelah `hpp_baseline`:

```typescript
export interface Recipe {
  id: string;
  user_id: string;
  name: string;
  hpp: number;
  prev_hpp: number;
  is_ingredient: boolean;
  is_addon: boolean;
  unit?: string;
  stock: number;
  avg_price: number;
  batch_yield: number;
  waste_pct: number;
  hpp_baseline?: number | null;
  selling_price?: number | null;   // ← tambah ini
  created_at: string;
  recipe_items?: RecipeItem[];
}
```

- [ ] **Step 2: Tambah `selling_price` ke interface `Item`**

Cari block `export interface Item {` (sekitar baris 15). Tambah setelah `is_addon`:

```typescript
export interface Item {
  id: string;
  user_id: string;
  name: string;
  unit: string;
  avg_price: number;
  prev_avg_price: number;
  avg_price_updated_at?: string | null;
  stock: number;
  is_addon: boolean;
  selling_price?: number | null;   // ← tambah ini
  created_at: string;
}
```

- [ ] **Step 3: Build check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add selling_price to Recipe and Item types"
```

---

### Task 3: useSales — Persist Selling Prices After Save

**Files:**
- Modify: `src/hooks/useSales.ts`

Tujuan: setiap kali sale berhasil disimpan, update `selling_price` di DB untuk semua resep dan add-on yang dipakai. Ini adalah update **best-effort** (error diabaikan, tidak memblokir sale).

- [ ] **Step 1: Tambah helper `persistSellingPrices` sebelum `useCreateSale`**

Tambah fungsi ini setelah blok `restoreAddonStock` (sekitar baris 189), sebelum `export function useCreateSale()`:

```typescript
async function persistSellingPrices(
  supabase: ReturnType<typeof createClient>,
  items: ItemInput[],
) {
  try {
    for (const item of items) {
      await supabase
        .from("recipes")
        .update({ selling_price: item.selling_price })
        .eq("id", item.recipe_id);
      for (const addon of item.addons ?? []) {
        if (addon.item_id) {
          await supabase
            .from("items")
            .update({ selling_price: addon.price_per_unit_at_sale })
            .eq("id", addon.item_id);
        } else if (addon.sub_recipe_id) {
          await supabase
            .from("recipes")
            .update({ selling_price: addon.price_per_unit_at_sale })
            .eq("id", addon.sub_recipe_id);
        }
      }
    }
  } catch {
    // best-effort, ignore errors
  }
}
```

- [ ] **Step 2: Panggil `persistSellingPrices` di `useCreateSale.mutationFn`**

Di `mutationFn` `useCreateSale`, setelah semua loop item selesai (sebelum `return saleId;`, sekitar baris 272):

```typescript
      }
    }

    await persistSellingPrices(supabase, p.items);  // ← tambah baris ini
    return saleId;
  },
```

- [ ] **Step 3: Panggil `persistSellingPrices` di `useUpdateSale.mutationFn`**

Di `mutationFn` `useUpdateSale`, setelah semua loop item selesai (setelah blok `if (item.addons?.length)`, sekitar baris 385, sebelum `}` penutup loop):

```typescript
      }
    }

    await persistSellingPrices(supabase, p.items);  // ← tambah baris ini
  },
```

- [ ] **Step 4: Build check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSales.ts
git commit -m "feat: persist selling prices to recipes/items after each sale"
```

---

### Task 4: Sales Form — selectRecipe, updateAddonPrice, selectAddonSource

**Files:**
- Modify: `src/app/sales/page.tsx`

- [ ] **Step 1: Tambah fungsi `selectRecipe` setelah `updateItemField`**

Cari fungsi `updateItemField` (sekitar baris 189). Tambah `selectRecipe` tepat sesudahnya:

```typescript
  function selectRecipe(key: string, recipeId: string) {
    const recipe = recipes?.find((r) => r.id === recipeId);
    setItemRows((rows) =>
      rows.map((r) => {
        if (r._key !== key) return r;
        return {
          ...r,
          recipeId,
          sellingPrice: recipe?.selling_price != null ? String(recipe.selling_price) : "",
        };
      }),
    );
  }
```

- [ ] **Step 2: Tambah fungsi `updateAddonPrice` setelah `removeAddonFromItem`**

Cari fungsi `removeAddonFromItem` (sekitar baris 211). Tambah `updateAddonPrice` sesudahnya:

```typescript
  function updateAddonPrice(itemKey: string, addonIdx: number, price: number) {
    setItemRows((rows) =>
      rows.map((r) =>
        r._key !== itemKey
          ? r
          : {
              ...r,
              addonRows: r.addonRows.map((a, i) =>
                i !== addonIdx ? a : { ...a, pricePerUnit: price },
              ),
            },
      ),
    );
  }
```

- [ ] **Step 3: Update `selectAddonSource` — pakai `selling_price` sebagai prioritas**

Cari fungsi `selectAddonSource` (sekitar baris 221). Ubah dua baris `pricePerUnit = ...`:

```typescript
  function selectAddonSource(itemKey: string, addonIdx: number, sourceKey: string) {
    const [type, id] = sourceKey.split(":");
    let name = "";
    let pricePerUnit = 0;
    if (type === "item") {
      const item = addonItems?.find((x) => x.id === id);
      name = item?.name ?? "";
      pricePerUnit = item?.selling_price ?? item?.avg_price ?? 0;
    } else if (type === "sr") {
      const sr =
        addonSubRecipes?.find((x) => x.id === id) ??
        addonFinishedRecipes?.find((x) => x.id === id);
      name = sr?.name ?? "";
      pricePerUnit = sr?.selling_price ?? sr?.avg_price ?? 0;
    }
    setItemRows((rows) =>
      rows.map((r) =>
        r._key !== itemKey
          ? r
          : {
              ...r,
              addonRows: r.addonRows.map((a, i) =>
                i !== addonIdx ? a : { ...a, sourceKey, name, pricePerUnit },
              ),
            },
      ),
    );
  }
```

- [ ] **Step 4: Ganti handler recipe select di JSX**

Cari di JSX (sekitar baris 1127):
```tsx
onChange={(e) =>
  updateItemField(row._key, "recipeId", e.target.value)
}
```
Ganti dengan:
```tsx
onChange={(e) =>
  selectRecipe(row._key, e.target.value)
}
```

- [ ] **Step 5: Build check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/sales/page.tsx
git commit -m "feat: auto-fill selling price when recipe/addon selected in sales form"
```

---

### Task 5: Sales Form — Clear Button & Margin Indicator pada Harga Jual Base Product

**Files:**
- Modify: `src/app/sales/page.tsx`

- [ ] **Step 1: Ubah blok `<div>` yang membungkus Input harga jual**

Cari blok ini (sekitar baris 1238–1260):
```tsx
                      <div>
                        <Input
                          label="Harga Jual per Unit (Rp)"
                          type="number"
                          min="0"
                          value={row.sellingPrice}
                          onChange={(e) =>
                            updateItemField(row._key, "sellingPrice", e.target.value)
                          }
                          required
                          placeholder={
                            hppPerUnit > 0 ? String(Math.ceil(hppPerUnit)) : undefined
                          }
                        />
                        {hppPerUnit > 0 && (
                          <p className="text-xs text-[#B88D6A] mt-1">
                            HPP Akhir/unit:{" "}
                            <span className="font-medium tabular-nums">
                              {formatCurrency(hppPerUnit)}
                            </span>
                          </p>
                        )}
                      </div>
```

Ganti dengan:
```tsx
                      <div>
                        <Input
                          label="Harga Jual per Unit (Rp)"
                          type="number"
                          min="0"
                          value={row.sellingPrice}
                          onChange={(e) =>
                            updateItemField(row._key, "sellingPrice", e.target.value)
                          }
                          required
                          placeholder={
                            hppPerUnit > 0 ? String(Math.ceil(hppPerUnit)) : undefined
                          }
                        />
                        <div className="flex items-center justify-between mt-1 gap-2">
                          <div className="flex items-center gap-2">
                            {hppPerUnit > 0 && (
                              <p className="text-xs text-[#B88D6A]">
                                HPP/unit:{" "}
                                <span className="font-medium tabular-nums">
                                  {formatCurrency(hppPerUnit)}
                                </span>
                              </p>
                            )}
                            {(() => {
                              const sp = Number(row.sellingPrice);
                              if (!sp || !hppPerUnit) return null;
                              const margin = ((sp - hppPerUnit) / sp) * 100;
                              const color =
                                margin >= 30
                                  ? "text-green-600"
                                  : margin >= 15
                                  ? "text-yellow-600"
                                  : "text-red-500";
                              return (
                                <span className={`text-xs font-semibold ${color}`}>
                                  Margin {margin.toFixed(1)}%
                                </span>
                              );
                            })()}
                          </div>
                          {row.sellingPrice !== "" && (
                            <button
                              type="button"
                              onClick={() =>
                                updateItemField(row._key, "sellingPrice", "")
                              }
                              className="flex items-center gap-0.5 text-xs text-[#B88D6A] hover:text-[#A05035] shrink-0"
                              aria-label="Hapus harga jual"
                            >
                              <X className="w-3 h-3" /> Hapus
                            </button>
                          )}
                        </div>
                      </div>
```

- [ ] **Step 2: Build check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/sales/page.tsx
git commit -m "feat: add clear button and live margin indicator to selling price input"
```

---

### Task 6: Sales Form — Addon Price Input & Clear Button

**Files:**
- Modify: `src/app/sales/page.tsx`

Restruktur tiap addon row menjadi 2 baris: (1) source select + remove, (2) qty + price + clear ×.

- [ ] **Step 1: Ubah blok tiap addon row**

Cari blok ini (sekitar baris 1153–1215):
```tsx
                        {row.addonRows.map((addon, addonIdx) => (
                          <div key={addonIdx} className="flex gap-2 items-center mb-1.5">
                            <div className="flex-1">
                              <select
                                className={`${cls} w-full`}
                                value={addon.sourceKey}
                                onChange={(e) =>
                                  selectAddonSource(row._key, addonIdx, e.target.value)
                                }
                                required
                              >
                                <option value="">Pilih add-on...</option>
                                {(addonItems ?? []).length > 0 && (
                                  <optgroup label="── Bahan Baku ──">
                                    {(addonItems ?? []).map((it) => (
                                      <option key={it.id} value={`item:${it.id}`}>
                                        {it.name} ({formatCurrency(it.avg_price)}/{it.unit})
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                {(addonSubRecipes ?? []).length > 0 && (
                                  <optgroup label="── Setengah Jadi ──">
                                    {(addonSubRecipes ?? []).map((sr) => (
                                      <option key={sr.id} value={`sr:${sr.id}`}>
                                        {sr.name} ({formatCurrency(sr.avg_price)}/{sr.unit})
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                {(addonFinishedRecipes ?? []).length > 0 && (
                                  <optgroup label="── Produk Jadi ──">
                                    {(addonFinishedRecipes ?? []).map((fr) => (
                                      <option key={fr.id} value={`sr:${fr.id}`}>
                                        {fr.name} ({formatCurrency(fr.avg_price)}/{fr.unit ?? "pcs"})
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                            </div>
                            <div className="w-20">
                              <input
                                type="number"
                                min="0.001"
                                step="0.001"
                                placeholder="Qty"
                                value={addon.quantity}
                                onChange={(e) =>
                                  updateAddonQty(row._key, addonIdx, e.target.value)
                                }
                                className={`${cls} w-full`}
                                required
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAddonFromItem(row._key, addonIdx)}
                              className="p-1.5 rounded text-[#D9CCAF] hover:text-red-500 flex-shrink-0"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
```

Ganti dengan:
```tsx
                        {row.addonRows.map((addon, addonIdx) => (
                          <div key={addonIdx} className="mb-2">
                            {/* Row 1: source select + remove */}
                            <div className="flex gap-2 items-center mb-1">
                              <div className="flex-1">
                                <select
                                  className={`${cls} w-full`}
                                  value={addon.sourceKey}
                                  onChange={(e) =>
                                    selectAddonSource(row._key, addonIdx, e.target.value)
                                  }
                                  required
                                >
                                  <option value="">Pilih add-on...</option>
                                  {(addonItems ?? []).length > 0 && (
                                    <optgroup label="── Bahan Baku ──">
                                      {(addonItems ?? []).map((it) => (
                                        <option key={it.id} value={`item:${it.id}`}>
                                          {it.name} ({formatCurrency(it.avg_price)}/{it.unit})
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                  {(addonSubRecipes ?? []).length > 0 && (
                                    <optgroup label="── Setengah Jadi ──">
                                      {(addonSubRecipes ?? []).map((sr) => (
                                        <option key={sr.id} value={`sr:${sr.id}`}>
                                          {sr.name} ({formatCurrency(sr.avg_price)}/{sr.unit})
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                  {(addonFinishedRecipes ?? []).length > 0 && (
                                    <optgroup label="── Produk Jadi ──">
                                      {(addonFinishedRecipes ?? []).map((fr) => (
                                        <option key={fr.id} value={`sr:${fr.id}`}>
                                          {fr.name} ({formatCurrency(fr.avg_price)}/{fr.unit ?? "pcs"})
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                </select>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeAddonFromItem(row._key, addonIdx)}
                                className="p-1.5 rounded text-[#D9CCAF] hover:text-red-500 flex-shrink-0"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                            </div>
                            {/* Row 2: qty + price + clear (tampil saat source dipilih) */}
                            {addon.sourceKey && (
                              <div className="flex gap-2 items-center pl-1">
                                <input
                                  type="number"
                                  min="0.001"
                                  step="0.001"
                                  placeholder="Qty"
                                  value={addon.quantity}
                                  onChange={(e) =>
                                    updateAddonQty(row._key, addonIdx, e.target.value)
                                  }
                                  className={`${cls} w-20`}
                                  required
                                />
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  placeholder="Harga jual"
                                  value={addon.pricePerUnit || ""}
                                  onChange={(e) =>
                                    updateAddonPrice(row._key, addonIdx, Number(e.target.value))
                                  }
                                  className={`${cls} flex-1`}
                                />
                                {addon.pricePerUnit > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => updateAddonPrice(row._key, addonIdx, 0)}
                                    className="text-[#B88D6A] hover:text-[#A05035] flex-shrink-0"
                                    aria-label="Hapus harga add-on"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
```

- [ ] **Step 2: Build check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/sales/page.tsx
git commit -m "feat: show and clear addon price in sales form"
```

---

### Task 7: Recipes Page — Margin Badge

**Files:**
- Modify: `src/app/recipes/page.tsx`

Tambah badge harga jual + margin di setiap card resep yang punya `selling_price`.

- [ ] **Step 1: Tambah margin badge setelah blok HPP**

Cari blok ini (sekitar baris 344–375):
```tsx
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-xs text-[#7C6352] font-medium">
                      HPP/pcs
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <span className="text-sm font-bold text-[#A05035] tabular-nums">
                        {formatCurrency(recipe.hpp)}
                      </span>
                      {(() => {
                        // ... existing HPP diff badge ...
                      })()}
                    </div>
                  </div>
```

Tambah blok baru **setelah** `</div>` penutup blok di atas, masih di dalam `<div className="border-t border-[#E5DACA] pt-3">`:

```tsx
                  {recipe.selling_price != null && (
                    <div className="flex justify-between items-center gap-2 mt-2">
                      <span className="text-xs text-[#7C6352] font-medium">
                        Jual/pcs
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-[#2C1810] tabular-nums">
                          {formatCurrency(recipe.selling_price)}
                        </span>
                        {recipe.hpp > 0 && (() => {
                          const margin = ((recipe.selling_price! - recipe.hpp) / recipe.selling_price!) * 100;
                          const color =
                            margin >= 30
                              ? "bg-green-50 text-green-700"
                              : margin >= 15
                              ? "bg-yellow-50 text-yellow-700"
                              : "bg-red-50 text-red-600";
                          return (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${color}`}>
                              {margin.toFixed(1)}%
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  )}
```

- [ ] **Step 2: Build check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/recipes/page.tsx
git commit -m "feat: show selling price and margin badge on recipe cards"
```

---

## Self-Review Checklist

- [x] **DB**: kolom `selling_price` di `recipes` dan `items` — Task 1
- [x] **Types**: `Recipe.selling_price` dan `Item.selling_price` — Task 2
- [x] **Persist setelah save**: `persistSellingPrices` di create dan update — Task 3
- [x] **Auto-fill base product**: `selectRecipe` — Task 4
- [x] **Auto-fill add-on**: `selectAddonSource` pakai `selling_price ?? avg_price` — Task 4
- [x] **Clear button base product**: × + "Hapus" di bawah input — Task 5
- [x] **Margin live di form**: warna hijau/kuning/merah — Task 5
- [x] **Addon price input + clear**: layout 2 baris — Task 6
- [x] **Margin badge Recipes page**: badge warna per resep — Task 7
- [x] **Query changes**: tidak perlu, semua query sudah `select("*")`
- [x] **No placeholders**: semua step punya exact code
