"use client";

export const dynamic = "force-dynamic";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { HelpTip } from "@/components/help/HelpTip";
import { UnitSelect, HARDCODED_UNITS } from "@/components/ui/UnitSelect";
import { Modal } from "@/components/ui/Modal";
import {
  useCreateItem,
  useDeleteItem,
  useItems,
  useUpdateItem,
} from "@/hooks/useItems";
import { useCustomUnits } from "@/hooks/useUnits";
import { useIsStaff } from "@/hooks/useAuth";
import { Item } from "@/types";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { ImportExcelModal } from "@/components/ui/ImportExcelModal";
import { AlertTriangle, FileUp, Filter, Package, Pencil, Plus, Search, Trash2, X } from "lucide-react";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getTenantId } from "@/lib/tenant";

type StockStatus = "minus" | "low" | "ok" | "unset";
// ponytail: batas menipis = stok <= min (inklusif); minus selalu menang
function stockStatus(i: Pick<Item, "stock" | "min_stock">): StockStatus {
  const s = i.stock ?? 0;
  if (s < 0) return "minus";
  if (i.min_stock == null) return "unset";
  return s <= i.min_stock ? "low" : "ok";
}

const cls =
  "h-9 rounded-lg border border-[#D9CCAF] bg-[#FBF8F2] px-3 text-sm text-[#2C1810] placeholder:text-[#B88D6A] focus:outline-none focus:ring-2 focus:ring-[#A05035] focus:border-transparent";

export default function ItemsPage() {
  const { data: items, isLoading } = useItems();
  const isStaff = useIsStaff();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const queryClient = useQueryClient();
  const { data: customUnits = [] } = useCustomUnits();

  const alertItems = useMemo(
    () => (items ?? []).filter((i) => ["minus", "low"].includes(stockStatus(i))),
    [items],
  );
  const minusCount = alertItems.filter((i) => stockStatus(i) === "minus").length;
  const lowCount = alertItems.length - minusCount;

  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  async function handleImportItems(rows: Record<string, unknown>[]) {
    const supabase = (await import("@/lib/supabase/client")).createClient();
    const tenantId = await getTenantId(supabase);
    const valid = rows
      .map((r) => ({
        name: String(r["nama"] ?? r["name"] ?? "").trim(),
        unit: String(r["unit"] ?? "")
          .trim()
          .toLowerCase(),
        min_stock: parseMin(r["min_stok"] ?? r["min_stock"]),
      }))
      .filter((r) => {
        const allUnits = [...HARDCODED_UNITS, ...(customUnits?.map(u => u.name.toLowerCase()) ?? [])];
        return r.name && allUnits.includes(r.unit) && !Number.isNaN(r.min_stock);
      });
    if (!valid.length) {
      toast.error("Tidak ada baris valid. Cek kolom nama & unit.");
      return;
    }
    setImporting(true);
    const { error } = await supabase
      .from("items")
      .insert(
        valid.map((r) => ({ ...r, user_id: tenantId, avg_price: 0, stock: 0 })),
      );
    setImporting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${valid.length} bahan berhasil diimpor`);
    queryClient.invalidateQueries({ queryKey: ["items"] });
  }

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<string>("gr");
  const [isAddon, setIsAddon] = useState(false);
  const [stock, setStock] = useState("");
  const [minStock, setMinStock] = useState("");

  const [search, setSearch] = useState("");
  const [filterUnit, setFilterUnit] = useState("");
  const [sortBy, setSortBy] = useState("name_asc");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [pendingSortBy, setPendingSortBy] = useState("name_asc");
  const [pendingFilterUnit, setPendingFilterUnit] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [pendingFilterStatus, setPendingFilterStatus] = useState("");
  const [filterAddon, setFilterAddon] = useState("");
  const [pendingFilterAddon, setPendingFilterAddon] = useState("");
  const [qtyMin, setQtyMin] = useState("");
  const [qtyMax, setQtyMax] = useState("");
  const [pendingQtyMin, setPendingQtyMin] = useState("");
  const [pendingQtyMax, setPendingQtyMax] = useState("");

  function openCreate() {
    setEditing(null);
    setName("");
    setUnit("gr");
    setIsAddon(false);
    setMinStock("");
    setModalOpen(true);
  }

  function openEdit(item: Item) {
    setEditing(item);
    setName(item.name);
    setUnit(item.unit);
    setIsAddon(item.is_addon ?? false);
    setStock(String(item.stock ?? 0));
    setMinStock(item.min_stock == null ? "" : String(item.min_stock));
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const min = parseMin(minStock);
    if (Number.isNaN(min)) {
      toast.error("Min. stok harus angka ≥ 0, atau kosongi");
      return;
    }
    const minPatch = isStaff ? {} : { min_stock: min };
    if (editing) {
      const n = Number(stock);
      if (!isStaff && stock.trim() !== "" && !Number.isFinite(n)) {
        toast.error("Stok tidak valid");
        return;
      }
      // ponytail: koreksi stok langsung tanpa log riwayat — tambah tabel stock_adjustments kalau butuh audit
      await updateItem.mutateAsync({
        id: editing.id,
        name: name.trim(),
        unit,
        is_addon: isAddon,
        ...minPatch,
        ...(!isStaff && stock.trim() !== "" ? { stock: n } : {}),
      });
    } else {
      await createItem.mutateAsync({ name: name.trim(), unit, is_addon: isAddon, ...minPatch });
    }
    setModalOpen(false);
  }

  function handleDelete(id: string) {
    if (!confirm("Hapus bahan ini?")) return;
    deleteItem.mutate(id);
  }

  const filtered = useMemo(() => {
    let rows = items ?? [];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((i) => i.name.toLowerCase().includes(q));
    }
    if (filterUnit) {
      rows = rows.filter((i) => i.unit === filterUnit);
      // rentang qty hanya bermakna dalam satu satuan
      if (qtyMin !== "") rows = rows.filter((i) => i.stock >= Number(qtyMin));
      if (qtyMax !== "") rows = rows.filter((i) => i.stock <= Number(qtyMax));
    }
    if (filterStatus) {
      rows = rows.filter((i) => {
        const st = stockStatus(i);
        switch (filterStatus) {
          case "alert": return st === "minus" || st === "low";
          case "empty": return (i.stock ?? 0) === 0;
          default: return st === filterStatus;
        }
      });
    }
    if (filterAddon) {
      rows = rows.filter((i) => (i.is_addon ?? false) === (filterAddon === "yes"));
    }
    return [...rows].sort((a, b) => {
      switch (sortBy) {
        case "critical":
          return criticality(a) - criticality(b);
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "price_desc":
          return b.avg_price - a.avg_price;
        case "price_asc":
          return a.avg_price - b.avg_price;
        case "stock_desc":
          return b.stock - a.stock;
        case "stock_asc":
          return a.stock - b.stock;
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [items, search, filterUnit, sortBy, filterStatus, filterAddon, qtyMin, qtyMax]);

  const activeFilterCount = [
    filterUnit,
    filterStatus,
    filterAddon,
    filterUnit && (qtyMin || qtyMax),
    sortBy !== "name_asc",
  ].filter(Boolean).length;
  const hasFilters = search || activeFilterCount > 0;

  const STATUS_LABEL: Record<string, string> = {
    alert: "Perlu restock", low: "Menipis", minus: "Minus", empty: "Habis (0)", ok: "Aman", unset: "Belum diatur min",
  };
  const SORT_LABEL: Record<string, string> = {
    name_desc: "Nama Z–A", critical: "Paling kritis", price_desc: "Harga ↑", price_asc: "Harga ↓", stock_desc: "Stok ↑", stock_asc: "Stok ↓",
  };
  const chips: { label: string; clear: () => void }[] = [
    filterUnit && {
      label: `Satuan: ${filterUnit}`,
      clear: () => { setFilterUnit(""); setPendingFilterUnit(""); setQtyMin(""); setQtyMax(""); setPendingQtyMin(""); setPendingQtyMax(""); },
    },
    filterUnit && (qtyMin || qtyMax) && {
      label: `Stok ${qtyMin || "…"}–${qtyMax || "…"} ${filterUnit}`,
      clear: () => { setQtyMin(""); setQtyMax(""); setPendingQtyMin(""); setPendingQtyMax(""); },
    },
    filterStatus && { label: `Status: ${STATUS_LABEL[filterStatus]}`, clear: () => { setFilterStatus(""); setPendingFilterStatus(""); } },
    filterAddon && { label: filterAddon === "yes" ? "Add-on saja" : "Bukan add-on", clear: () => { setFilterAddon(""); setPendingFilterAddon(""); } },
    sortBy !== "name_asc" && { label: `Urut: ${SORT_LABEL[sortBy]}`, clear: () => { setSortBy("name_asc"); setPendingSortBy("name_asc"); } },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  function resetAll() {
    setSearch("");
    setFilterUnit(""); setPendingFilterUnit("");
    setFilterStatus(""); setPendingFilterStatus("");
    setFilterAddon(""); setPendingFilterAddon("");
    setQtyMin(""); setQtyMax(""); setPendingQtyMin(""); setPendingQtyMax("");
    setSortBy("name_asc"); setPendingSortBy("name_asc");
  }

  return (
    <AppLayout
      title="Bahan Baku"
      action={
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setImportOpen(true)}
          >
            <FileUp className="w-4 h-4" />
            <span className="hidden sm:inline">Impor</span>
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Tambah</span>
          </Button>
        </div>
      }
    >
      {alertItems.length > 0 && (
        <div
          className={`mb-3 flex items-center gap-3 rounded-xl border px-4 py-3 ${
            minusCount ? "border-red-200 bg-red-50" : "border-[#E8C48A] bg-[#FBF0DC]"
          }`}
        >
          <AlertTriangle className={`h-4 w-4 shrink-0 ${minusCount ? "text-red-500" : "text-[#B4691F]"}`} />
          <button
            onClick={() => { setFilterStatus("alert"); setPendingFilterStatus("alert"); }}
            className={`flex-1 text-left text-sm font-medium hover:underline ${minusCount ? "text-red-700" : "text-[#8A4B12]"}`}
          >
            {[minusCount && `${minusCount} stok minus`, lowCount && `${lowCount} menipis`]
              .filter(Boolean)
              .join(" · ")}{" "}
            — lihat
          </button>
        </div>
      )}

      <Card>
        {/* Filter bottom sheet */}
        {filterSheetOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40"
              onClick={() => setFilterSheetOpen(false)}
            />
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#FBF8F2] rounded-t-2xl shadow-xl p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#2C1810]">Filter</span>
                <button onClick={() => setFilterSheetOpen(false)} className="text-[#B88D6A] hover:text-[#7C6352]">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-[#7C6352] mb-1 block">Urutan</label>
                  <select
                    className={`${cls} w-full`}
                    value={pendingSortBy}
                    onChange={(e) => setPendingSortBy(e.target.value)}
                  >
                    <option value="name_asc">Nama A–Z</option>
                    <option value="critical">Paling kritis</option>
                    <option value="name_desc">Nama Z–A</option>
                    {!isStaff && <option value="price_desc">Harga ↑</option>}
                    {!isStaff && <option value="price_asc">Harga ↓</option>}
                    <option value="stock_desc">Stok ↑</option>
                    <option value="stock_asc">Stok ↓</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#7C6352] mb-1 block">Satuan</label>
                  <select
                    className={`${cls} w-full`}
                    value={pendingFilterUnit}
                    onChange={(e) => setPendingFilterUnit(e.target.value)}
                  >
                    <option value="">Semua satuan</option>
                    {[...HARDCODED_UNITS, ...customUnits.map(u => u.name)].map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#7C6352] mb-1 block">
                    Rentang stok{pendingFilterUnit && ` (${pendingFilterUnit})`}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" step="any" inputMode="decimal" placeholder="Dari"
                      className={`${cls} w-full disabled:opacity-50`}
                      disabled={!pendingFilterUnit}
                      value={pendingQtyMin}
                      onChange={(e) => setPendingQtyMin(e.target.value)}
                    />
                    <span className="text-[#B88D6A]">–</span>
                    <input
                      type="number" step="any" inputMode="decimal" placeholder="Sampai"
                      className={`${cls} w-full disabled:opacity-50`}
                      disabled={!pendingFilterUnit}
                      value={pendingQtyMax}
                      onChange={(e) => setPendingQtyMax(e.target.value)}
                    />
                  </div>
                  {!pendingFilterUnit && (
                    <p className="mt-1 text-xs text-[#B88D6A]">Pilih satuan dulu biar angka stok bisa dibandingkan.</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-[#7C6352] mb-1 block">Status stok</label>
                  <select
                    className={`${cls} w-full`}
                    value={pendingFilterStatus}
                    onChange={(e) => setPendingFilterStatus(e.target.value)}
                  >
                    <option value="">Semua</option>
                    <option value="alert">Perlu restock (minus + menipis)</option>
                    <option value="low">Menipis</option>
                    <option value="minus">Minus</option>
                    <option value="empty">Habis (0)</option>
                    <option value="ok">Aman</option>
                    <option value="unset">Belum diatur min. stok</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#7C6352] mb-1 block">Add-on</label>
                  <select
                    className={`${cls} w-full`}
                    value={pendingFilterAddon}
                    onChange={(e) => setPendingFilterAddon(e.target.value)}
                  >
                    <option value="">Semua</option>
                    <option value="yes">Add-on saja</option>
                    <option value="no">Bukan add-on</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    setPendingSortBy("name_asc");
                    setPendingFilterUnit("");
                    setPendingFilterStatus("");
                    setPendingFilterAddon("");
                    setPendingQtyMin("");
                    setPendingQtyMax("");
                  }}
                  className="flex-1 h-9 rounded-lg border border-[#D9CCAF] text-sm text-[#7C6352] font-medium hover:bg-[#EDE4CF] transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={() => {
                    setSortBy(pendingSortBy);
                    setFilterUnit(pendingFilterUnit);
                    setFilterStatus(pendingFilterStatus);
                    setFilterAddon(pendingFilterAddon);
                    setQtyMin(pendingFilterUnit ? pendingQtyMin : "");
                    setQtyMax(pendingFilterUnit ? pendingQtyMax : "");
                    setFilterSheetOpen(false);
                  }}
                  className="flex-1 h-9 rounded-lg bg-[#A05035] text-sm text-white font-medium hover:bg-[#8B4530] transition-colors"
                >
                  Terapkan
                </button>
              </div>
            </div>
          </>
        )}

        <div className="px-4 py-3 border-b border-[#E5DACA] space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#B88D6A]" />
              <input
                className={`${cls} w-full pl-8`}
                placeholder="Cari nama bahan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#B88D6A] hover:text-[#7C6352]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={() => {
                setPendingSortBy(sortBy);
                setPendingFilterUnit(filterUnit);
                setPendingFilterStatus(filterStatus);
                setPendingFilterAddon(filterAddon);
                setPendingQtyMin(qtyMin);
                setPendingQtyMax(qtyMax);
                setFilterSheetOpen(true);
              }}
              className={`relative h-9 px-3 rounded-lg border text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeFilterCount
                  ? "border-[#A05035] bg-[#A05035]/10 text-[#A05035]"
                  : "border-[#D9CCAF] bg-[#FBF8F2] text-[#7C6352] hover:bg-[#EDE4CF]"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filter
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#A05035] text-white text-[10px] flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <button
                  key={c.label}
                  onClick={c.clear}
                  aria-label={`Hapus filter ${c.label}`}
                  className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1.5 rounded-full border border-[#A05035]/40 bg-[#A05035]/10 text-xs font-medium text-[#A05035] hover:bg-[#A05035]/20 transition-colors"
                >
                  {c.label}
                  <X className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-[#B88D6A]">
            <span>
              {filtered.length} bahan
              {(items?.length ?? 0) > filtered.length &&
                ` dari ${items?.length}`}
            </span>
            {hasFilters && (
              <button
                onClick={resetAll}
                className="text-[#A05035] hover:underline font-medium"
              >
                Reset semua
              </button>
            )}
          </div>
        </div>

        <CardBody className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-[#B88D6A]">
              Memuat...
            </div>
          ) : !items?.length ? (
            <EmptyState
              icon={Package}
              title="Belum ada bahan"
              description="Tambah bahan baku untuk melacak biaya dan stok."
              action={
                <Button size="sm" onClick={openCreate}>
                  <Plus className="w-4 h-4" /> Tambah Bahan
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#B88D6A]">
              Tidak ada bahan untuk filter ini
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E5DACA]">
                    <th className="text-left px-4 sm:px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                      Nama
                    </th>
                    <th className="text-left px-3 sm:px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                      Satuan
                    </th>
                    <th className="text-right px-3 sm:px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                      <span className="inline-flex items-center justify-end gap-1">
                        {isStaff ? "Harga Jual" : "Harga Rata-rata"}
                        <HelpTip fieldId="item.avgPrice" />
                      </span>
                    </th>
                    <th className="text-right px-3 sm:px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide hidden sm:table-cell">
                      Stok
                    </th>
                    <th className="px-3 sm:px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const st = stockStatus(item);
                    return (
                    <tr
                      key={item.id}
                      className={`border-b border-[#EDE4CF] last:border-0 transition-colors ${ROW_CLS[st]}`}
                    >
                      <td className="px-4 sm:px-6 py-2.5 sm:py-3 font-medium text-[#2C1810]">
                        <span className="break-words">{item.name}</span>
                        <span className="sm:hidden block text-xs text-[#B88D6A] font-normal mt-0.5">
                          Stok: <span className="whitespace-nowrap">{formatNumber(item.stock, 2)} {item.unit}</span> <StockBadge st={st} />
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-2.5 sm:py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#EDE4CF] text-[#5C4535]">
                          {item.unit}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-2.5 sm:py-3 text-right tabular-nums text-[#4A3728] text-xs sm:text-sm whitespace-nowrap">
                        {formatCurrency(isStaff ? item.selling_price ?? 0 : item.avg_price)}
                      </td>
                      <td className="px-3 sm:px-6 py-2.5 sm:py-3 text-right tabular-nums text-[#4A3728] text-xs hidden sm:table-cell">
                        {formatNumber(item.stock, 2)} {item.unit}
                        <StockBadge st={st} />
                        {item.min_stock != null && (
                          <span className="block text-[10px] text-[#B88D6A]">min {formatNumber(item.min_stock, 2)}</span>
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-2.5 sm:py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(item)}
                            className="p-1.5 rounded-lg text-[#B88D6A] hover:text-[#A05035] hover:bg-[#EDE4CF] cursor-pointer transition-colors"
                            aria-label="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 rounded-lg text-[#B88D6A] hover:text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                            aria-label="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Bahan" : "Tambah Bahan"}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Nama Bahan"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="mis. Tepung Terigu"
          />
          <UnitSelect label="Unit" value={unit} onChange={setUnit} required />
          {!isStaff && (
            <div className="flex flex-col gap-1">
              <Input
                label={`Min. Stok (${unit})`}
                help={<HelpTip fieldId="item.minStock" />}
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                placeholder="Kosongi jika tidak dipantau"
                helper="Jika bahan ini tidak dipantau min. stok nya, kosongi saja jangan kasih 0"
              />
              {editing && unit !== editing.unit && minStock.trim() !== "" && (
                <p className="text-xs font-medium text-[#B4691F]">
                  Awas, minimum stok ini awalnya dari {editing.unit}
                </p>
              )}
            </div>
          )}
          {editing && !isStaff && (
            <Input
              label={`Stok (${unit})`}
              type="number"
              step="any"
              inputMode="decimal"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
          )}
          <div className="flex items-center gap-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAddon}
                onChange={(e) => setIsAddon(e.target.checked)}
                className="w-4 h-4 rounded accent-[#A05035]"
              />
              <span className="text-sm text-[#4A3728]">Bisa dijadikan Add-On penjualan</span>
            </label>
            <HelpTip fieldId="item.isAddon" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalOpen(false)}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              type="submit"
              loading={createItem.isPending || updateItem.isPending}
              className="flex-1"
            >
              {editing ? "Simpan" : "Buat"}
            </Button>
          </div>
        </form>
      </Modal>

      <ImportExcelModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Impor Bahan Baku"
        templateFilename="template_items.xlsx"
        templateColumns={["nama", "unit", "min_stok"]}
        templateRows={[
          ["Tepung Terigu", "gr", "1000"],
          ["Gula Pasir", "kg", ""],
          ["Minyak Goreng", "liter", "2"],
        ]}
        previewColumns={[
          { key: "nama", label: "Nama" },
          { key: "unit", label: "Satuan" },
          { key: "min_stok", label: "Min. Stok" },
        ]}
        onImport={handleImportItems}
        importing={importing}
      />
    </AppLayout>
  );
}

/** "" / null → null (tidak dipantau); angka ≥ 0 → angka; selain itu NaN (invalid). */
function parseMin(v: unknown): number | null {
  const t = String(v ?? "").trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

/** Urutan "paling kritis": minus dulu, lalu rasio stok/min terkecil; tanpa min paling bawah. */
function criticality(i: Item): number {
  const s = i.stock ?? 0;
  if (s < 0) return -1e9 + s;
  if (i.min_stock == null) return 1e9;
  return i.min_stock === 0 ? (s === 0 ? 0 : 1e8) : s / i.min_stock;
}

const ROW_CLS: Record<StockStatus, string> = {
  minus: "bg-red-50 hover:bg-red-100 shadow-[inset_3px_0_0_#DC2626]",
  low: "bg-[#FBF0DC] hover:bg-[#F6E4C4] shadow-[inset_3px_0_0_#C9822B]",
  ok: "hover:bg-[#F5EFE0]",
  unset: "hover:bg-[#F5EFE0]",
};

function StockBadge({ st }: { st: StockStatus }) {
  if (st === "minus")
    return <span className="ml-1.5 inline-block rounded px-1.5 py-px text-[10px] font-semibold bg-red-100 text-red-700">Minus</span>;
  if (st === "low")
    return <span className="ml-1.5 inline-block rounded px-1.5 py-px text-[10px] font-semibold bg-[#F3D9A8] text-[#8A4B12]">Menipis</span>;
  return null;
}
