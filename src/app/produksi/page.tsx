"use client";

export const dynamic = "force-dynamic";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  useProductions,
  useDeleteProduction,
  useUpdateProduction,
  useProduceSubRecipe,
  useProduceRecipe,
} from "@/hooks/usePurchases";
import { calcHPP, useRecipes } from "@/hooks/useRecipes";
import { createClient } from "@/lib/supabase/client";
import { Production } from "@/types";
import { formatCurrency, formatNumber, formatThousands } from "@/lib/utils";
import { format } from "date-fns";
import { AlertTriangle, Factory, Filter, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

const cls =
  "h-9 rounded-lg border border-[#D9CCAF] bg-[#FBF8F2] px-3 text-sm text-[#2C1810] placeholder:text-[#B88D6A] focus:outline-none focus:ring-2 focus:ring-[#A05035] focus:border-transparent";

export default function ProduksiPage() {
  const { data: productions, isLoading } = useProductions();
  const { data: recipes } = useRecipes();
  const deleteProduction = useDeleteProduction();
  const updateProduction = useUpdateProduction();
  const produceSubRecipe = useProduceSubRecipe();
  const produceRecipe = useProduceRecipe();
  const qc = useQueryClient();

  // ─── Item (bahan baku) shortfall — info only ──────────────────────────────
  interface ItemShortfall {
    name: string;
    unit: string;
    currentStock: number;
    needed: number;
  }
  const [itemConfirm, setItemConfirm] = useState<ItemShortfall[] | null>(null);

  // ─── Sub-recipe auto-produce confirm state ─────────────────────────────────
  interface SubRecipeShortfall {
    recipeId: string;
    recipeName: string;
    currentStock: number;
    needed: number;
    unit: string;
    hpp: number;
  }
  const [subRecipeConfirm, setSubRecipeConfirm] = useState<{
    shortfalls: SubRecipeShortfall[];
    mainPayload: { recipe_id: string; batches: number; total_cost: number; date: string };
  } | null>(null);
  const [subProducePending, setSubProducePending] = useState(false);

  // ─── Create modal state ────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"jadi" | "setengah">("jadi");
  const [recipeId, setRecipeId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  // ─── Edit modal state ──────────────────────────────────────────────────────
  const [editing, setEditing] = useState<Production | null>(null);
  const [editBatches, setEditBatches] = useState("");
  const [editCost, setEditCost] = useState("");

  // ─── Filter / search state ─────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [pendingDateFrom, setPendingDateFrom] = useState("");
  const [pendingDateTo, setPendingDateTo] = useState("");

  // ─── Derived data ──────────────────────────────────────────────────────────
  const { finishedRecipes, subRecipes } = useMemo(() => {
    const finished = [];
    const sub = [];
    for (const r of recipes ?? []) {
      if (r.is_ingredient) sub.push(r);
      else if (!r.is_addon) finished.push(r);
    }
    return { finishedRecipes: finished, subRecipes: sub };
  }, [recipes]);

  const selectedRecipe = useMemo(() => {
    const pool = mode === "jadi" ? finishedRecipes : subRecipes;
    return pool.find((r) => r.id === recipeId);
  }, [recipeId, mode, finishedRecipes, subRecipes]);

  const estimatedHpp = useMemo(() => {
    if (!selectedRecipe || !quantity) return null;
    // Bulatkan HPP per unit ke atas DULU, baru dikali jumlah — agar
    // (HPP/unit ditampilkan) × jumlah selalu = total estimasi.
    const perUnit = Math.ceil(selectedRecipe.hpp ?? 0);
    return Math.ceil(perUnit * Number(quantity));
  }, [selectedRecipe, quantity]);

  const filteredProductions = useMemo(() => {
    let rows = productions ?? [];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((p) => (p.recipe?.name ?? "").toLowerCase().includes(q));
    }
    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      from.setHours(0, 0, 0, 0);
      rows = rows.filter((p) => new Date(p.created_at) >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59, 999);
      rows = rows.filter((p) => new Date(p.created_at) <= to);
    }
    return rows;
  }, [productions, search, filterDateFrom, filterDateTo]);

  const hasFilters = search || filterDateFrom || filterDateTo;

  // ─── Handlers ──────────────────────────────────────────────────────────────
  function openCreate() {
    setMode("jadi");
    setRecipeId("");
    setQuantity("");
    setTotalCost("");
    setDate(new Date().toISOString().slice(0, 10));
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recipeId || !quantity || !totalCost) return;
    const payload = {
      recipe_id: recipeId,
      batches: Number(quantity),
      total_cost: Number(totalCost),
      date,
    };
    // Check item (bahan baku) stocks first for both modes
    const itemShortfalls: ItemShortfall[] = [];
    for (const ri of selectedRecipe?.recipe_items ?? []) {
      if (!ri.item_id || !ri.item) continue;
      const needed = ri.quantity_used * Number(quantity);
      if ((ri.item.stock ?? 0) < needed) {
        itemShortfalls.push({
          name: ri.item.name,
          unit: ri.item.unit ?? "pcs",
          currentStock: ri.item.stock ?? 0,
          needed,
        });
      }
    }
    if (itemShortfalls.length > 0) {
      setItemConfirm(itemShortfalls);
      setModalOpen(false);
      return;
    }

    if (mode === "jadi") {
      // Check sub-recipe ingredient stocks before producing
      const shortfalls: SubRecipeShortfall[] = [];
      for (const ri of selectedRecipe?.recipe_items ?? []) {
        if (!ri.sub_recipe_id || !ri.sub_recipe) continue;
        const sr = ri.sub_recipe;
        const needed = ri.quantity_used * Number(quantity);
        if ((sr.stock ?? 0) < needed) {
          shortfalls.push({
            recipeId: sr.id,
            recipeName: sr.name,
            currentStock: sr.stock ?? 0,
            needed,
            unit: sr.unit ?? "pcs",
            hpp: calcHPP(sr.recipe_items ?? [], false, sr.batch_yield ?? 1, sr.waste_pct ?? 0),
          });
        }
      }
      if (shortfalls.length > 0) {
        setSubRecipeConfirm({ shortfalls, mainPayload: payload });
        setModalOpen(false);
        return;
      }
      await produceRecipe.mutateAsync(payload);
    } else {
      await produceSubRecipe.mutateAsync(payload);
    }
    setModalOpen(false);
  }

  async function handleProduceSubAndMain() {
    if (!subRecipeConfirm) return;
    setSubProducePending(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      for (const sf of subRecipeConfirm.shortfalls) {
        const shortfall = sf.needed - sf.currentStock;
        const { error } = await supabase.rpc("produce_sub_recipe", {
          p_user_id: user!.id,
          p_recipe_id: sf.recipeId,
          p_batches: shortfall,
          p_total_cost: sf.hpp * shortfall,
        });
        if (error) throw new Error(`Gagal produksi "${sf.recipeName}": ${error.message}`);
      }
      const mp = subRecipeConfirm.mainPayload;
      const { error: mainErr } = await supabase.rpc("produce_recipe", {
        p_user_id: user!.id,
        p_recipe_id: mp.recipe_id,
        p_batches: mp.batches,
        p_total_cost: mp.total_cost,
      });
      if (mainErr) throw mainErr;
      setSubRecipeConfirm(null);
      toast.success("Produksi dicatat");
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Gagal produksi bahan");
    } finally {
      setSubProducePending(false);
      qc.invalidateQueries({ queryKey: ["productions"] });
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["recipes"] });
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editBatches || !editCost) return;
    await updateProduction.mutateAsync({
      id: editing.id,
      batches: Number(editBatches),
      total_cost: Number(editCost),
    });
    setEditing(null);
  }

  const isPending = produceRecipe.isPending || produceSubRecipe.isPending;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <AppLayout
      title="Produksi"
      action={
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Tambah</span>
        </Button>
      }
    >
      <Card>
        {/* Filter bottom sheet */}
        {filterSheetOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setFilterSheetOpen(false)} />
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#FBF8F2] rounded-t-2xl shadow-xl p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#2C1810]">Filter Produksi</span>
                <button onClick={() => setFilterSheetOpen(false)} className="text-[#B88D6A] hover:text-[#7C6352]">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-[#7C6352] mb-1 block">Dari tanggal</label>
                  <input type="date" className={`${cls} w-full`} value={pendingDateFrom}
                    onChange={(e) => setPendingDateFrom(e.target.value)} max={pendingDateTo || undefined} />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#7C6352] mb-1 block">Sampai tanggal</label>
                  <input type="date" className={`${cls} w-full`} value={pendingDateTo}
                    onChange={(e) => setPendingDateTo(e.target.value)} min={pendingDateFrom || undefined} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setPendingDateFrom(""); setPendingDateTo(""); }}
                  className="flex-1 h-9 rounded-lg border border-[#D9CCAF] text-sm text-[#7C6352] font-medium hover:bg-[#EDE4CF] transition-colors">
                  Reset
                </button>
                <button onClick={() => { setFilterDateFrom(pendingDateFrom); setFilterDateTo(pendingDateTo); setFilterSheetOpen(false); }}
                  className="flex-1 h-9 rounded-lg bg-[#A05035] text-sm text-white font-medium hover:bg-[#8B4530] transition-colors">
                  Terapkan
                </button>
              </div>
            </div>
          </>
        )}

        <CardBody className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-[#B88D6A]">Memuat...</div>
          ) : !(productions ?? []).length ? (
            <EmptyState
              icon={Factory}
              title="Belum ada produksi"
              description="Catat produksi produk jadi atau bahan setengah jadi di sini."
              action={
                <Button size="sm" onClick={openCreate}>
                  <Plus className="w-4 h-4" /> Catat Produksi
                </Button>
              }
            />
          ) : (
            <>
              {/* Search + filter bar */}
              <div className="px-4 py-3 border-b border-[#E5DACA] space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#B88D6A]" />
                    <input className={`${cls} w-full pl-8`} placeholder="Cari produk..."
                      value={search} onChange={(e) => setSearch(e.target.value)} />
                    {search && (
                      <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#B88D6A] hover:text-[#7C6352]">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => { setPendingDateFrom(filterDateFrom); setPendingDateTo(filterDateTo); setFilterSheetOpen(true); }}
                    className={`relative h-9 px-3 rounded-lg border text-sm font-medium transition-colors flex items-center gap-1.5 ${
                      (filterDateFrom || filterDateTo)
                        ? "border-[#A05035] bg-[#A05035]/10 text-[#A05035]"
                        : "border-[#D9CCAF] bg-[#FBF8F2] text-[#7C6352] hover:bg-[#EDE4CF]"
                    }`}
                  >
                    <Filter className="w-3.5 h-3.5" />
                    Filter
                    {(filterDateFrom || filterDateTo) && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#A05035] text-white text-[10px] flex items-center justify-center font-bold">
                        {[filterDateFrom, filterDateTo].filter(Boolean).length}
                      </span>
                    )}
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-[#B88D6A]">
                  <span>
                    {filteredProductions.length} hasil
                    {(productions?.length ?? 0) > filteredProductions.length && ` dari ${productions?.length}`}
                  </span>
                  {hasFilters && (
                    <button onClick={() => { setSearch(""); setFilterDateFrom(""); setFilterDateTo(""); setPendingDateFrom(""); setPendingDateTo(""); }}
                      className="text-[#A05035] hover:underline font-medium">
                      Reset semua
                    </button>
                  )}
                </div>
              </div>

              {/* Productions list */}
              <div className="divide-y divide-[#EDE4CF]">
                {filteredProductions.length === 0 ? (
                  <div className="py-10 text-center text-sm text-[#B88D6A]">Tidak ada hasil untuk filter ini</div>
                ) : filteredProductions.map((prod) => {
                  const isIngredient = (prod.recipe as any)?.is_ingredient ?? false;
                  return (
                    <div key={prod.id} className="flex items-center justify-between px-4 py-3 hover:bg-[#F5EFE0] transition-colors gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-[#2C1810] truncate">{prod.recipe?.name ?? "—"}</p>
                          <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            isIngredient
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}>
                            {isIngredient ? "½ Jadi" : "Jadi"}
                          </span>
                        </div>
                        <span className="text-xs text-[#B88D6A]">
                          {prod.batches} {prod.recipe?.unit ?? "pcs"} · {format(new Date(prod.created_at), "dd MMM yyyy")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold text-amber-700 tabular-nums">
                          {formatCurrency(prod.total_cost)}
                        </span>
                        <button
                          onClick={() => { setEditing(prod); setEditBatches(String(prod.batches)); setEditCost(String(prod.total_cost)); }}
                          className="p-1.5 rounded-lg text-[#B88D6A] hover:text-[#A05035] hover:bg-[#EDE4CF] transition-colors"
                          aria-label="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { if (confirm("Hapus produksi ini?")) deleteProduction.mutate(prod.id); }}
                          className="p-1.5 rounded-lg text-[#B88D6A] hover:text-red-500 hover:bg-red-50 transition-colors"
                          aria-label="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {/* ── Create modal ──────────────────────────────────────────────────────── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Catat Produksi" size="sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Type toggle */}
          <div className="flex gap-1 rounded-xl border border-[#D9CCAF] bg-[#F5EFE0] p-1">
            <button type="button" onClick={() => { setMode("jadi"); setRecipeId(""); }}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === "jadi" ? "bg-white text-[#2C1810] shadow-sm" : "text-[#7C6352] hover:text-[#2C1810]"}`}>
              Produk Jadi
            </button>
            <button type="button" onClick={() => { setMode("setengah"); setRecipeId(""); }}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === "setengah" ? "bg-white text-[#2C1810] shadow-sm" : "text-[#7C6352] hover:text-[#2C1810]"}`}>
              Setengah Jadi
            </button>
          </div>

          {/* Recipe selector */}
          <div>
            <label className="block text-sm font-medium text-[#4A3728] mb-1">
              {mode === "jadi" ? "Produk" : "Bahan Setengah Jadi"}
            </label>
            <select
              className={`${cls} w-full`}
              value={recipeId}
              onChange={(e) => {
                const newId = e.target.value;
                setRecipeId(newId);
                const pool = mode === "jadi" ? finishedRecipes : subRecipes;
                const r = pool.find((x) => x.id === newId);
                if (r && quantity) {
                  setTotalCost(String(Math.ceil(Math.ceil(r.hpp ?? 0) * Number(quantity))));
                } else {
                  setTotalCost("");
                }
              }}
              required
            >
              <option value="">Pilih {mode === "jadi" ? "produk" : "bahan"}...</option>
              {(mode === "jadi" ? finishedRecipes : subRecipes).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}{r.unit ? ` (${r.unit})` : ""}
                  {mode === "jadi" && ` · stok: ${r.stock ?? 0}`}
                </option>
              ))}
            </select>
          </div>

          <Input
            label={`Jumlah diproduksi${selectedRecipe?.unit ? ` (${selectedRecipe.unit})` : " (pcs)"}`}
            type="number" min="0.01" step="0.01"
            value={quantity}
            onChange={(e) => {
              const qty = e.target.value;
              setQuantity(qty);
              if (selectedRecipe && qty) {
                setTotalCost(String(Math.ceil(Math.ceil(selectedRecipe.hpp ?? 0) * Number(qty))));
              } else {
                setTotalCost("");
              }
            }}
            required
          />

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-[#4A3728]">
                Total biaya produksi (Rp) <span className="text-red-500">*</span>
              </label>
              {estimatedHpp !== null && totalCost !== "" &&
                Number(totalCost) !== estimatedHpp && (
                <button
                  type="button"
                  onClick={() => setTotalCost(String(estimatedHpp))}
                  className="text-xs text-[#A05035] hover:underline font-medium"
                >
                  ← Pakai estimasi
                </button>
              )}
            </div>
            <input
              type="text" inputMode="numeric"
              className={`${cls} w-full`}
              value={formatThousands(totalCost)}
              onChange={(e) => setTotalCost(e.target.value.replace(/\./g, ""))}
              required
            />
            {estimatedHpp !== null && (
              <p className="mt-1 text-xs text-amber-700 font-medium">
                Estimasi HPP: <span className="font-bold">{formatCurrency(estimatedHpp)}</span>
                {selectedRecipe && (
                  <> · HPP/unit: <span className="font-bold">{formatCurrency(Math.ceil(selectedRecipe.hpp ?? 0))}</span></>
                )}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#4A3728] mb-1">Tanggal</label>
            <input type="date" className={`${cls} w-full`} value={date}
              onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} required />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)} className="flex-1">Batal</Button>
            <Button type="submit" loading={isPending} className="flex-1">Simpan</Button>
          </div>
        </form>
      </Modal>

      {/* ── Edit modal ────────────────────────────────────────────────────────── */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Produksi" size="sm">
        {editing && (
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
            <div className="rounded-lg bg-[#F5EFE0] border border-[#D9CCAF] px-4 py-2.5">
              <p className="text-xs text-[#7C6352]">Produk</p>
              <p className="text-sm font-medium text-[#2C1810]">{editing.recipe?.name ?? "—"}</p>
            </div>
            <Input
              label={`Jumlah (${editing.recipe?.unit ?? "pcs"})`}
              type="number" min="0.01" step="0.01"
              value={editBatches} onChange={(e) => setEditBatches(e.target.value)} required
            />
            <Input
              label="Total biaya (Rp)"
              type="text" inputMode="numeric"
              value={formatThousands(editCost)} onChange={(e) => setEditCost(e.target.value.replace(/\./g, ""))} required
            />
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)} className="flex-1">Batal</Button>
              <Button type="submit" loading={updateProduction.isPending} className="flex-1">Simpan</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Item bahan baku kurang — info only ────────────────────────────────── */}
      {itemConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setItemConfirm(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-[#FBF8F2] p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span className="font-semibold text-[#2C1810]">Bahan baku tidak cukup</span>
            </div>
            <div className="mb-5 space-y-2">
              {itemConfirm.map((sf) => (
                <div key={sf.name} className="rounded-lg border border-[#D9CCAF] bg-white px-3 py-2.5 text-sm">
                  <p className="font-medium text-[#2C1810]">{sf.name}</p>
                  <p className="mt-0.5 text-[#7C6352]">
                    Stok: <span className="font-medium text-red-600">{formatNumber(sf.currentStock, 2)} {sf.unit}</span>
                    {" · "}Dibutuhkan: <span className="font-medium">{formatNumber(sf.needed, 2)} {sf.unit}</span>
                    {" · "}Kurang: <span className="font-medium text-amber-700">{formatNumber(sf.needed - sf.currentStock, 2)} {sf.unit}</span>
                  </p>
                </div>
              ))}
            </div>
            <p className="mb-4 text-sm text-[#7C6352]">
              Tambahkan stok bahan baku terlebih dahulu sebelum produksi.
            </p>
            <Button variant="ghost" onClick={() => setItemConfirm(null)} className="w-full">
              Batal
            </Button>
          </div>
        </div>
      )}

      {/* ── Sub-recipe auto-produce confirm ────────────────────────────────────── */}
      {subRecipeConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSubRecipeConfirm(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-[#FBF8F2] p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span className="font-semibold text-[#2C1810]">Bahan setengah jadi kurang</span>
            </div>
            <div className="mb-5 space-y-2">
              {subRecipeConfirm.shortfalls.map((sf) => (
                <div key={sf.recipeId} className="rounded-lg border border-[#D9CCAF] bg-white px-3 py-2.5 text-sm">
                  <p className="font-medium text-[#2C1810]">{sf.recipeName}</p>
                  <p className="mt-0.5 text-[#7C6352]">
                    Stok: <span className="font-medium text-red-600">{formatNumber(sf.currentStock, 2)} {sf.unit}</span>
                    {" · "}Dibutuhkan: <span className="font-medium">{formatNumber(sf.needed, 2)} {sf.unit}</span>
                    {" · "}Kurang: <span className="font-medium text-amber-700">{formatNumber(sf.needed - sf.currentStock, 2)} {sf.unit}</span>
                  </p>
                </div>
              ))}
            </div>
            <p className="mb-4 text-sm text-[#7C6352]">
              Produksi otomatis akan deduct bahan baku sesuai resep masing-masing.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={handleProduceSubAndMain} loading={subProducePending} className="w-full">
                Produksi Bahan & Lanjutkan
              </Button>
              <Button variant="ghost" onClick={() => setSubRecipeConfirm(null)} disabled={subProducePending} className="w-full">
                Batal
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
