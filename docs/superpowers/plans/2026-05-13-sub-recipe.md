# Sub-Recipe (Bahan Setengah Jadi) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memungkinkan sebuah resep dijadikan bahan baku (sub-resep) untuk resep lain, dengan stok yang dikelola lewat halaman Pembelian dan berkurang otomatis saat produk induk terjual.

**Architecture:** Extend tabel `recipes` dengan kolom `is_ingredient/unit/stock/avg_price`, extend `recipe_items` dengan kolom nullable `sub_recipe_id`. Produksi dicatat via RPC `produce_sub_recipe` (tambah stok sub-resep + kurangi stok bahan baku). HPP dihitung rekursif di frontend. Stok sub-resep berkurang client-side di `useCreateSale` via RPC `deduct_sub_recipe_stock`.

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL + PostgREST), React Query (TanStack), TypeScript, Tailwind CSS

---

## File Map

| File | Action | Tanggung jawab |
|---|---|---|
| `supabase/migrations/006_sub_recipe.sql` | Create | Schema changes + semua RPC baru |
| `src/types/index.ts` | Modify | Extend Recipe, RecipeItem; tambah Production |
| `src/hooks/useRecipes.ts` | Modify | Query nested + calcHPP rekursif + payload mutation |
| `src/hooks/usePurchases.ts` | Modify | Tambah useProduceSubRecipe + useProductions |
| `src/hooks/useSales.ts` | Modify | useCreateSale deduct sub-recipe stock |
| `src/app/recipes/page.tsx` | Modify | is_ingredient UI + BomRow sub-recipe support |
| `src/app/purchases/page.tsx` | Modify | Dropdown gabungan + production flow UI |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/006_sub_recipe.sql`

- [ ] **Step 1: Buat file migration**

```sql
-- supabase/migrations/006_sub_recipe.sql

-- ── 1. Extend recipes ──────────────────────────────────────────────────────
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS is_ingredient boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unit          text     CHECK (unit IN ('gr','ml','pcs','kg','liter')),
  ADD COLUMN IF NOT EXISTS stock         numeric(15,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_price     numeric(15,4) NOT NULL DEFAULT 0;

-- ── 2. Extend recipe_items ────────────────────────────────────────────────
ALTER TABLE public.recipe_items
  ADD COLUMN IF NOT EXISTS sub_recipe_id uuid REFERENCES public.recipes(id) ON DELETE RESTRICT;

ALTER TABLE public.recipe_items
  ALTER COLUMN item_id DROP NOT NULL;

-- Tepat salah satu dari item_id atau sub_recipe_id harus terisi
ALTER TABLE public.recipe_items
  ADD CONSTRAINT one_ingredient_source
    CHECK ((item_id IS NOT NULL) != (sub_recipe_id IS NOT NULL));

-- Tidak boleh menunjuk ke resep itu sendiri
ALTER TABLE public.recipe_items
  ADD CONSTRAINT no_self_reference
    CHECK (sub_recipe_id IS DISTINCT FROM recipe_id);

-- Unique: satu sub-resep tidak bisa muncul dua kali dalam resep yang sama
CREATE UNIQUE INDEX IF NOT EXISTS recipe_items_unique_sub_recipe
  ON public.recipe_items (recipe_id, sub_recipe_id)
  WHERE sub_recipe_id IS NOT NULL;

-- ── 3. Tabel productions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.productions (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id   uuid        NOT NULL REFERENCES public.recipes(id) ON DELETE RESTRICT,
  batches     numeric(15,4) NOT NULL CHECK (batches > 0),
  total_cost  numeric(15,2) NOT NULL CHECK (total_cost >= 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.productions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_productions" ON public.productions
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS productions_user_created_idx
  ON public.productions (user_id, created_at DESC);

-- ── 4. RPC: produce_sub_recipe ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.produce_sub_recipe(
  p_user_id    uuid,
  p_recipe_id  uuid,
  p_batches    numeric,
  p_total_cost numeric,
  p_created_at timestamptz DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_stock numeric;
  v_current_avg   numeric;
  v_new_stock     numeric;
  v_new_avg       numeric;
  v_ri            record;
BEGIN
  SELECT stock, avg_price
    INTO v_current_stock, v_current_avg
    FROM public.recipes
   WHERE id = p_recipe_id AND user_id = p_user_id AND is_ingredient = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sub-recipe not found or not marked as ingredient';
  END IF;

  v_new_stock := v_current_stock + p_batches;

  IF v_new_stock > 0 THEN
    v_new_avg := (v_current_stock * v_current_avg + p_total_cost) / v_new_stock;
  ELSE
    v_new_avg := CASE WHEN p_batches > 0 THEN p_total_cost / p_batches ELSE 0 END;
  END IF;

  UPDATE public.recipes
     SET stock     = v_new_stock,
         avg_price = v_new_avg
   WHERE id = p_recipe_id AND user_id = p_user_id;

  -- Kurangi stok setiap bahan baku
  FOR v_ri IN
    SELECT ri.item_id, ri.quantity_used
      FROM public.recipe_items ri
     WHERE ri.recipe_id = p_recipe_id AND ri.item_id IS NOT NULL
  LOOP
    UPDATE public.items
       SET stock = stock - (v_ri.quantity_used * p_batches)
     WHERE id = v_ri.item_id AND user_id = p_user_id;
  END LOOP;

  INSERT INTO public.productions (user_id, recipe_id, batches, total_cost, created_at)
  VALUES (p_user_id, p_recipe_id, p_batches, p_total_cost, COALESCE(p_created_at, now()));
END;
$$;

-- ── 5. RPC: deduct_sub_recipe_stock ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deduct_sub_recipe_stock(
  p_user_id   uuid,
  p_recipe_id uuid,
  p_quantity  numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.recipes
     SET stock = stock - p_quantity
   WHERE id = p_recipe_id AND user_id = p_user_id;
END;
$$;
```

- [ ] **Step 2: Apply migration ke Supabase**

Paste isi file ke Supabase SQL Editor (project `tqhfnaerzttcfceoygxw`) dan run.

Verifikasi:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'recipes' ORDER BY ordinal_position;
-- Harus ada: is_ingredient, unit, stock, avg_price

SELECT column_name FROM information_schema.columns WHERE table_name = 'recipe_items' ORDER BY ordinal_position;
-- Harus ada: sub_recipe_id

SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'productions';
-- Harus ada 1 row
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/006_sub_recipe.sql
git commit -m "feat: add sub-recipe schema, productions table, RPCs"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Update `Recipe`, `RecipeItem`, tambah `Production`**

Ganti seluruh isi `src/types/index.ts`:

```ts
export interface Item {
  id: string;
  user_id: string;
  name: string;
  unit: "gr" | "ml" | "pcs" | "kg" | "liter";
  avg_price: number;
  prev_avg_price: number;
  stock: number;
  created_at: string;
}

export interface Purchase {
  id: string;
  user_id: string;
  item_id: string;
  quantity: number;
  total_price: number;
  price_per_unit: number;
  created_at: string;
  item?: Item;
}

export interface Recipe {
  id: string;
  user_id: string;
  name: string;
  hpp: number;           // computed client-side by calcHPP
  prev_hpp: number;      // computed client-side by calcHPP(usePrev=true)
  is_ingredient: boolean;
  unit?: "gr" | "ml" | "pcs" | "kg" | "liter";
  stock: number;
  avg_price: number;
  created_at: string;
  recipe_items?: RecipeItem[];
}

export interface RecipeItem {
  id: string;
  recipe_id: string;
  item_id?: string | null;
  sub_recipe_id?: string | null;
  quantity_used: number;
  item?: Item;
  sub_recipe?: Recipe;
}

export interface Production {
  id: string;
  user_id: string;
  recipe_id: string;
  batches: number;
  total_cost: number;
  created_at: string;
  recipe?: Recipe;
}

export interface SaleCategory {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Sale {
  id: string;
  user_id: string;
  recipe_id: string;
  category_id: string | null;
  quantity_sold: number;
  selling_price: number;
  hpp_at_sale: number;
  profit: number;
  created_at: string;
  recipe?: Recipe;
  category?: SaleCategory;
}

export interface ExpenseCategory {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  category_id: string | null;
  name: string;
  qty: number;
  price: number;
  total: number;
  note: string | null;
  created_at: string;
  category?: ExpenseCategory;
}

export interface DashboardStats {
  total_revenue: number;
  total_hpp: number;
  total_profit: number;
  profit_margin: number;
  sales_count: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: extend types for sub-recipe support"
```

---

## Task 3: useRecipes — Query + calcHPP Rekursif + Mutation Payload

**Files:**
- Modify: `src/hooks/useRecipes.ts`

- [ ] **Step 1: Update `useRecipes` query dan `calcHPP`**

Ganti seluruh isi `src/hooks/useRecipes.ts`:

```ts
"use client";

import { createClient } from "@/lib/supabase/client";
import { Recipe, RecipeItem } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

export function calcHPP(items: RecipeItem[], usePrev: boolean): number {
  return items.reduce((sum, ri) => {
    if (ri.sub_recipe_id && ri.sub_recipe) {
      const subItems = (ri.sub_recipe as any).recipe_items ?? [];
      const subHPP = calcHPP(subItems, usePrev);
      return sum + subHPP * ri.quantity_used;
    }
    const item = ri.item as any;
    const price = usePrev
      ? (item?.prev_avg_price || item?.avg_price || 0)
      : (item?.avg_price ?? 0);
    return sum + price * ri.quantity_used;
  }, 0);
}

export function useRecipes() {
  return useQuery<Recipe[]>({
    queryKey: ["recipes"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("recipes")
        .select(
          `*,
          recipe_items(
            *,
            item:items(name, unit, avg_price, prev_avg_price),
            sub_recipe:recipes(
              id, name, unit, stock, avg_price, is_ingredient,
              recipe_items(
                quantity_used, item_id,
                item:items(name, unit, avg_price, prev_avg_price)
              )
            )
          )`
        )
        .order("name");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        is_ingredient: r.is_ingredient ?? false,
        stock: r.stock ?? 0,
        avg_price: r.avg_price ?? 0,
        hpp: calcHPP(r.recipe_items ?? [], false),
        prev_hpp: calcHPP(r.recipe_items ?? [], true),
      }));
    },
  });
}

export function useCreateRecipe() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      name: string;
      is_ingredient?: boolean;
      unit?: string | null;
      items: Array<{
        item_id?: string | null;
        sub_recipe_id?: string | null;
        quantity_used: number;
      }>;
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: recipe, error: re } = await supabase
        .from("recipes")
        .insert({
          name: payload.name,
          user_id: user!.id,
          is_ingredient: payload.is_ingredient ?? false,
          unit: payload.unit ?? null,
        })
        .select()
        .single();
      if (re) throw re;

      const { error: rie } = await supabase.from("recipe_items").insert(
        payload.items.map((i) => ({
          recipe_id: recipe.id,
          item_id: i.item_id ?? null,
          sub_recipe_id: i.sub_recipe_id ?? null,
          quantity_used: i.quantity_used,
        }))
      );
      if (rie) throw rie;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Recipe created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateRecipe() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      name: string;
      is_ingredient?: boolean;
      unit?: string | null;
      items: Array<{
        item_id?: string | null;
        sub_recipe_id?: string | null;
        quantity_used: number;
      }>;
    }) => {
      const supabase = createClient();
      const { error: re } = await supabase
        .from("recipes")
        .update({
          name: payload.name,
          is_ingredient: payload.is_ingredient ?? false,
          unit: payload.unit ?? null,
        })
        .eq("id", payload.id);
      if (re) throw re;

      const { error: de } = await supabase
        .from("recipe_items")
        .delete()
        .eq("recipe_id", payload.id);
      if (de) throw de;

      const { error: ie } = await supabase.from("recipe_items").insert(
        payload.items.map((i) => ({
          recipe_id: payload.id,
          item_id: i.item_id ?? null,
          sub_recipe_id: i.sub_recipe_id ?? null,
          quantity_used: i.quantity_used,
        }))
      );
      if (ie) throw ie;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Recipe updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("recipes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Recipe deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
```

- [ ] **Step 2: Verifikasi TypeScript tidak error**

```bash
npx tsc --noEmit
```

Expected: tidak ada error.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useRecipes.ts
git commit -m "feat: extend useRecipes with sub-recipe query and recursive calcHPP"
```

---

## Task 4: usePurchases — useProduceSubRecipe + useProductions

**Files:**
- Modify: `src/hooks/usePurchases.ts`

- [ ] **Step 1: Tambah hook `useProduceSubRecipe` dan `useProductions` di akhir file**

Baca file `src/hooks/usePurchases.ts` terlebih dahulu, lalu tambahkan di bagian akhir (setelah `useDeletePurchase`):

```ts
export function useProductions() {
  return useQuery({
    queryKey: ["productions"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("productions")
        .select("*, recipe:recipes(name, unit)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProduceSubRecipe() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (p: {
      recipe_id: string;
      batches: number;
      total_cost: number;
      date?: string;
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.rpc("produce_sub_recipe", {
        p_user_id: user!.id,
        p_recipe_id: p.recipe_id,
        p_batches: p.batches,
        p_total_cost: p.total_cost,
        ...(p.date ? { p_created_at: new Date(p.date).toISOString() } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["productions"] });
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Produksi dicatat");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
```

- [ ] **Step 2: Verifikasi**

```bash
npx tsc --noEmit
```

Expected: tidak ada error.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePurchases.ts
git commit -m "feat: add useProduceSubRecipe and useProductions hooks"
```

---

## Task 5: useSales — Deduct Sub-Recipe Stock on Sale

**Files:**
- Modify: `src/hooks/useSales.ts`

- [ ] **Step 1: Update `useCreateSale` untuk terima dan proses sub-recipe deductions**

Di `src/hooks/useSales.ts`, ganti fungsi `useCreateSale` (baris 116–149):

```ts
export function useCreateSale() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (p: {
      recipe_id: string;
      quantity_sold: number;
      selling_price: number;
      hpp_at_sale: number;
      category_id?: string | null;
      date?: string;
      sub_recipe_deductions?: Array<{
        sub_recipe_id: string;
        quantity: number;
      }>;
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const profit = p.selling_price - p.hpp_at_sale;
      const { date, sub_recipe_deductions, ...rest } = p;
      const { error } = await supabase.from("sales").insert({
        ...rest,
        profit,
        user_id: user!.id,
        ...(date ? { created_at: new Date(date).toISOString() } : {}),
      });
      if (error) throw error;

      // Kurangi stok sub-resep yang dipakai
      if (sub_recipe_deductions?.length) {
        for (const d of sub_recipe_deductions) {
          await supabase.rpc("deduct_sub_recipe_stock", {
            p_user_id: user!.id,
            p_recipe_id: d.sub_recipe_id,
            p_quantity: d.quantity,
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Penjualan dicatat");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
```

- [ ] **Step 2: Verifikasi**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSales.ts
git commit -m "feat: deduct sub-recipe stock on sale via useCreateSale"
```

---

## Task 6: Recipes Page — is_ingredient UI + BOM Sub-Recipe Support

**Files:**
- Modify: `src/app/recipes/page.tsx`

Halaman ini cukup kompleks — perubahan dilakukan bertahap.

- [ ] **Step 1: Update `BomRow` interface dan tambah state**

Di `src/app/recipes/page.tsx`, ganti interface `BomRow` dan tambah state baru:

```ts
// Ganti interface BomRow (baris 35-38):
interface BomRow {
  item_id: string;        // diisi jika bahan baku biasa
  sub_recipe_id: string;  // diisi jika sub-resep; salah satu selalu ""
  quantity_used: string;
}

// Di dalam RecipesPage(), tambah state setelah state `rows`:
const [isIngredient, setIsIngredient] = useState(false);
const [unit, setUnit] = useState<Recipe["unit"]>("pcs");
```

- [ ] **Step 2: Update `openCreate`, `openEdit`, `addRow`, `updateRow`**

```ts
function openCreate() {
  setEditing(null);
  setName("");
  setIsIngredient(false);
  setUnit("pcs");
  setRows([{ item_id: "", sub_recipe_id: "", quantity_used: "" }]);
  setModalOpen(true);
}

function openEdit(recipe: Recipe) {
  setEditing(recipe);
  setName(recipe.name);
  setIsIngredient(recipe.is_ingredient ?? false);
  setUnit(recipe.unit ?? "pcs");
  setRows(
    (recipe.recipe_items ?? []).map((ri) => ({
      item_id: ri.item_id ?? "",
      sub_recipe_id: ri.sub_recipe_id ?? "",
      quantity_used: String(ri.quantity_used),
    }))
  );
  setModalOpen(true);
}

function addRow() {
  setRows((r) => [...r, { item_id: "", sub_recipe_id: "", quantity_used: "" }]);
}

function updateRow(i: number, field: keyof BomRow, val: string) {
  setRows((r) =>
    r.map((row, idx) => {
      if (idx !== i) return row;
      // Jika user pilih item_id, clear sub_recipe_id dan sebaliknya
      if (field === "item_id") return { ...row, item_id: val, sub_recipe_id: "" };
      if (field === "sub_recipe_id") return { ...row, sub_recipe_id: val, item_id: "" };
      return { ...row, [field]: val };
    })
  );
}
```

- [ ] **Step 3: Update `calcPreviewHPP` dan `handleSubmit`**

```ts
// Ganti calcPreviewHPP:
function calcPreviewHPP(): number {
  return rows.reduce((sum, row) => {
    const qty = Number(row.quantity_used);
    if (row.sub_recipe_id) {
      const sr = recipes?.find((r) => r.id === row.sub_recipe_id);
      return sum + (sr?.hpp ?? 0) * qty;
    }
    const item = items?.find((i) => i.id === row.item_id);
    return sum + (item?.avg_price ?? 0) * qty;
  }, 0);
}

// Ganti handleSubmit:
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  const validRows = rows.filter(
    (r) => (r.item_id || r.sub_recipe_id) && Number(r.quantity_used) > 0
  );
  if (!name.trim() || validRows.length === 0) return;
  const bomItems = validRows.map((r) => ({
    item_id: r.item_id || null,
    sub_recipe_id: r.sub_recipe_id || null,
    quantity_used: Number(r.quantity_used),
  }));
  if (editing) {
    await updateRecipe.mutateAsync({
      id: editing.id,
      name: name.trim(),
      is_ingredient: isIngredient,
      unit: isIngredient ? unit : null,
      items: bomItems,
    });
  } else {
    await createRecipe.mutateAsync({
      name: name.trim(),
      is_ingredient: isIngredient,
      unit: isIngredient ? unit : null,
      items: bomItems,
    });
  }
  setModalOpen(false);
  setEditing(null);
  setName("");
  setRows([{ item_id: "", sub_recipe_id: "", quantity_used: "" }]);
}
```

- [ ] **Step 4: Update BOM dropdown di modal untuk tampilkan sub-resep**

Di dalam JSX modal, ganti setiap baris BOM dropdown (bagian `rows.map(...)`) dengan:

```tsx
{rows.map((row, i) => {
  // Sub-resep yang bisa dipilih: is_ingredient=true, bukan dirinya sendiri,
  // dan tidak menyebabkan circular (tidak menggunakan resep yang sedang diedit sebagai ingredientnya)
  const subRecipeOptions = (recipes ?? []).filter(
    (r) =>
      r.is_ingredient &&
      r.id !== editing?.id &&
      !(r.recipe_items ?? []).some(
        (ri) => ri.sub_recipe_id === editing?.id || ri.item_id === editing?.id
      )
  );

  return (
    <div key={i} className="flex gap-2 items-center">
      <select
        className={`${cls} flex-1`}
        value={row.sub_recipe_id ? `sr:${row.sub_recipe_id}` : row.item_id}
        onChange={(e) => {
          const val = e.target.value;
          if (val.startsWith("sr:")) {
            updateRow(i, "sub_recipe_id", val.slice(3));
          } else {
            updateRow(i, "item_id", val);
          }
        }}
        required
      >
        <option value="">Pilih bahan...</option>
        {(items ?? []).length > 0 && (
          <optgroup label="── Bahan Baku ──">
            {(items ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.unit})
              </option>
            ))}
          </optgroup>
        )}
        {subRecipeOptions.length > 0 && (
          <optgroup label="── Produk Setengah Jadi ──">
            {subRecipeOptions.map((r) => (
              <option key={r.id} value={`sr:${r.id}`}>
                {r.name} ({r.unit})
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <input
        className={`${cls} w-24`}
        type="number"
        min="0.01"
        step="0.01"
        placeholder="Qty"
        value={row.quantity_used}
        onChange={(e) => updateRow(i, "quantity_used", e.target.value)}
        required
      />
      {rows.length > 1 && (
        <button
          type="button"
          onClick={() => removeRow(i)}
          className="p-1.5 text-[#B88D6A] hover:text-red-500"
        >
          <Minus className="w-4 h-4" />
        </button>
      )}
    </div>
  );
})}
```

- [ ] **Step 5: Tambah UI is_ingredient di modal form**

Di dalam modal form (setelah field `name`, sebelum BOM rows), tambahkan:

```tsx
{/* Checkbox is_ingredient */}
<label className="flex items-center gap-2 cursor-pointer">
  <input
    type="checkbox"
    checked={isIngredient}
    onChange={(e) => setIsIngredient(e.target.checked)}
    className="w-4 h-4 rounded accent-[#A05035]"
  />
  <span className="text-sm font-medium text-[#4A3728]">
    Jadikan Bahan Setengah Jadi
  </span>
</label>
{isIngredient && (
  <Select
    label="Satuan Produksi"
    value={unit ?? "pcs"}
    onChange={(e) => setUnit(e.target.value as Recipe["unit"])}
    required
  >
    {(["gr", "ml", "pcs", "kg", "liter"] as const).map((u) => (
      <option key={u} value={u}>{u}</option>
    ))}
  </Select>
)}
```

- [ ] **Step 6: Tambah badge di card resep**

Di card resep (bagian `recipe.name` di list), tambahkan badge setelah nama:

```tsx
{recipe.is_ingredient && (
  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
    Setengah Jadi
  </span>
)}
```

- [ ] **Step 7: Verifikasi**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add src/app/recipes/page.tsx
git commit -m "feat: add is_ingredient UI and sub-recipe BOM support in recipes page"
```

---

## Task 7: Purchases Page — Production Flow UI

**Files:**
- Modify: `src/app/purchases/page.tsx`

- [ ] **Step 1: Tambah import hooks baru**

Di bagian import `src/app/purchases/page.tsx`, tambahkan:

```ts
import { useProduceSubRecipe, useProductions } from "@/hooks/usePurchases";
import { useRecipes } from "@/hooks/useRecipes";
```

- [ ] **Step 2: Tambah state dan hook di dalam `PurchasesPage`**

```ts
const { data: subRecipes } = useRecipes();
const produceSubRecipe = useProduceSubRecipe();
const { data: productions } = useProductions();

// State untuk production mode
const [isProduction, setIsProduction] = useState(false);
const [subRecipeId, setSubRecipeId] = useState("");
```

- [ ] **Step 3: Update fungsi `openCreate` dan `handleSubmit`**

```ts
function openCreate() {
  setEditing(null);
  setItemId("");
  setQuantity("");
  setTotalPrice("");
  setDate(new Date().toISOString().slice(0, 10));
  setIsProduction(false);
  setSubRecipeId("");
  setModalOpen(true);
}

// Ganti handleSubmit:
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  if (!quantity || !totalPrice) return;
  if (Number(quantity) <= 0) return;
  if (Number(totalPrice) < 0) return;

  if (editing) {
    await updatePurchase.mutateAsync({
      id: editing.id,
      quantity: Number(quantity),
      total_price: Number(totalPrice),
    });
  } else if (isProduction) {
    if (!subRecipeId) return;
    await produceSubRecipe.mutateAsync({
      recipe_id: subRecipeId,
      batches: Number(quantity),
      total_cost: Number(totalPrice),
      date,
    });
    setSubRecipeId("");
    setIsProduction(false);
  } else {
    if (!itemId) return;
    await createPurchase.mutateAsync({
      item_id: itemId,
      quantity: Number(quantity),
      total_price: Number(totalPrice),
      date,
    });
  }
  setModalOpen(false);
  setEditing(null);
  setItemId("");
  setQuantity("");
  setTotalPrice("");
  setDate(new Date().toISOString().slice(0, 10));
}
```

- [ ] **Step 4: Update modal form untuk mode produksi**

Di dalam modal form (bagian pemilihan item saat `!editing`), ganti dengan:

```tsx
{!editing && (
  <>
    {/* Toggle purchase vs produksi */}
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => { setIsProduction(false); setSubRecipeId(""); setItemId(""); }}
        className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
          !isProduction
            ? "bg-[#A05035] text-white border-[#A05035]"
            : "bg-[#FBF8F2] text-[#7C6352] border-[#D9CCAF]"
        }`}
      >
        Pembelian
      </button>
      <button
        type="button"
        onClick={() => { setIsProduction(true); setItemId(""); }}
        className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
          isProduction
            ? "bg-amber-600 text-white border-amber-600"
            : "bg-[#FBF8F2] text-[#7C6352] border-[#D9CCAF]"
        }`}
      >
        Produksi
      </button>
    </div>

    {!isProduction ? (
      <Select
        label="Bahan"
        value={itemId}
        onChange={(e) => setItemId(e.target.value)}
        required
      >
        <option value="">Pilih bahan...</option>
        {items?.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name} ({i.unit})
          </option>
        ))}
      </Select>
    ) : (
      <Select
        label="Produk Setengah Jadi"
        value={subRecipeId}
        onChange={(e) => setSubRecipeId(e.target.value)}
        required
      >
        <option value="">Pilih produk...</option>
        {(subRecipes ?? [])
          .filter((r) => r.is_ingredient)
          .map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.unit})
            </option>
          ))}
      </Select>
    )}
  </>
)}
```

- [ ] **Step 5: Update label field Jumlah & Total dan preview HPP**

Ganti label field `Jumlah` dengan kondisional, dan tambahkan preview HPP untuk mode produksi:

```tsx
<Input
  label={isProduction ? "Jumlah Batch Diproduksi" : "Jumlah"}
  type="number"
  min="0.01"
  step="0.01"
  value={quantity}
  onChange={(e) => setQuantity(e.target.value)}
  required
/>
<Input
  label={isProduction ? "Total Biaya Produksi (Rp)" : "Total Harga (Rp)"}
  type="number"
  min="0"
  value={totalPrice}
  onChange={(e) => setTotalPrice(e.target.value)}
  required
/>

{/* Preview HPP untuk produksi */}
{isProduction && subRecipeId && (() => {
  const sr = (subRecipes ?? []).find((r) => r.id === subRecipeId);
  if (!sr) return null;
  const hppPerUnit = sr.hpp;
  const suggestedCost = hppPerUnit * (Number(quantity) || 1);
  return (
    <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5">
      <p className="text-xs text-amber-700 font-medium">
        HPP per {sr.unit}: <span className="font-bold">{formatCurrency(hppPerUnit)}</span>
        {quantity && (
          <> · Estimasi biaya: <span className="font-bold">{formatCurrency(suggestedCost)}</span></>
        )}
      </p>
    </div>
  );
})()}

{/* Preview harga per unit untuk pembelian biasa */}
{!isProduction && pricePerUnit > 0 && (
  <div className="rounded-lg bg-[#737B4C]/10 border border-[#737B4C]/20 px-4 py-2.5">
    <p className="text-xs text-[#5C6B38] font-medium">
      Harga per unit: <span className="font-bold">{formatCurrency(pricePerUnit)}</span>
    </p>
  </div>
)}
```

- [ ] **Step 6: Tambah produksi ke list (tab atau gabung dengan purchases)**

Di bagian list (setelah `filtered.map(...)`), tambahkan entri produksi. Ini ditampilkan bersama purchases tapi dengan badge berbeda.

Tambahkan di bawah `</Card>` section utama, sebagai card terpisah:

```tsx
{/* Productions list */}
{(productions ?? []).length > 0 && (
  <Card className="mt-4">
    <div className="px-4 py-3 border-b border-[#E5DACA]">
      <h3 className="text-sm font-semibold text-[#2C1810]">Log Produksi</h3>
    </div>
    <CardBody className="p-0">
      <div className="divide-y divide-[#EDE4CF]">
        {(productions ?? []).map((prod: any) => (
          <div key={prod.id} className="flex justify-between items-center px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#2C1810]">
                  {prod.recipe?.name ?? "—"}
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
                  Produksi
                </span>
              </div>
              <span className="text-xs text-[#B88D6A]">
                {prod.batches} {prod.recipe?.unit} · {format(new Date(prod.created_at), "dd MMM yyyy")}
              </span>
            </div>
            <span className="text-sm font-semibold text-amber-700 tabular-nums">
              {formatCurrency(prod.total_cost)}
            </span>
          </div>
        ))}
      </div>
    </CardBody>
  </Card>
)}
```

- [ ] **Step 7: Verifikasi TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add src/app/purchases/page.tsx
git commit -m "feat: add production flow UI to purchases page"
```

---

## Task 8: Sales Page — Pass Sub-Recipe Deductions

**Files:**
- Modify: `src/app/sales/page.tsx`

- [ ] **Step 1: Baca bagian `handleSubmit` / `createSale.mutateAsync` di sales page**

Baca `src/app/sales/page.tsx` bagian di mana `createSale.mutateAsync` dipanggil.

- [ ] **Step 2: Tambah sub_recipe_deductions ke pemanggilan createSale**

Di `src/app/sales/page.tsx` baris 110-119, ganti blok `else` (create new sale):

```ts
} else {
  if (!recipeId) return;
  // selectedRecipe sudah ada di baris 53: recipes?.find((r) => r.id === recipeId)
  const sub_recipe_deductions = (selectedRecipe?.recipe_items ?? [])
    .filter((ri) => ri.sub_recipe_id)
    .map((ri) => ({
      sub_recipe_id: ri.sub_recipe_id!,
      quantity: ri.quantity_used * Number(quantity),
    }));
  await createSale.mutateAsync({
    recipe_id: recipeId,
    quantity_sold: Number(quantity),
    selling_price: Number(sellingPrice),
    hpp_at_sale: hpp,
    category_id: categoryId || null,
    date,
    sub_recipe_deductions,
  });
}
```

`useRecipes` sudah diimport dan `selectedRecipe` sudah didefinisikan di baris 31 dan 53 — tidak perlu tambah import atau state baru.

- [ ] **Step 3: Verifikasi**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/sales/page.tsx
git commit -m "feat: deduct sub-recipe stock when recording sale"
```

---

## Task 9: End-to-End Verification

- [ ] **Step 1: Jalankan dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test skenario lengkap**

Lakukan urutan berikut di browser:

1. **Buat sub-resep** → Produk → Produk Baru → centang "Jadikan Bahan Setengah Jadi" → pilih unit → isi BOM dengan bahan baku → Simpan. Verifikasi badge "Setengah Jadi" muncul di card.

2. **Gunakan sub-resep di produk induk** → Produk → Produk Baru → di BOM dropdown, pilih dari section "Produk Setengah Jadi" → Simpan. Verifikasi HPP produk induk include HPP sub-resep × qty.

3. **Catat produksi** → Pembelian → Tambah → klik tab "Produksi" → pilih sub-resep → isi jumlah batch dan total biaya → Catat. Verifikasi: stok sub-resep naik (cek di DB atau detail resep), stok bahan baku turun, log produksi muncul di bawah halaman Pembelian.

4. **Catat penjualan produk induk** → Penjualan → catat penjualan → Verifikasi stok sub-resep turun sesuai quantity × quantity_used.

5. **Coba circular reference** → Produk → edit sub-resep → coba tambah produk induk sebagai ingredient → Verifikasi opsi tersebut tidak tersedia di dropdown.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete sub-recipe (bahan setengah jadi) implementation"
```
