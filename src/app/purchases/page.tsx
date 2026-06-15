"use client";

export const dynamic = "force-dynamic";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Input";
import { HelpTip } from "@/components/help/HelpTip";
import { Modal } from "@/components/ui/Modal";
import { useItems } from "@/hooks/useItems";
import {
  useCreatePurchase,
  useDeletePurchase,
  usePurchases,
  useUpdatePurchase,
} from "@/hooks/usePurchases";
import { usePackagingTypes, useCreatePackagingType } from "@/hooks/usePackagingTypes";
import { Purchase } from "@/types";
import { formatCurrency, formatThousands } from "@/lib/utils";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { ImportExcelModal } from "@/components/ui/ImportExcelModal";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, FileUp, Filter, Pencil, Plus, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

const cls =
  "h-9 rounded-lg border border-[#D9CCAF] bg-[#FBF8F2] px-3 text-sm text-[#2C1810] placeholder:text-[#B88D6A] focus:outline-none focus:ring-2 focus:ring-[#A05035] focus:border-transparent";

interface PurchaseItemRow {
  _key: string;
  itemId: string;
  quantity: string;
  pricePerUnit: string;
  usePkg: boolean;
  pkgTypeId: string;
  pkgQty: string;
  sizePerPkg: string;
  pkgPriceMode: "per_unit" | "per_pkg";
  pricePerPkg: string;
  addingPkgType: boolean;
  newPkgTypeName: string;
}

function emptyItemRow(): PurchaseItemRow {
  return {
    _key: crypto.randomUUID(),
    itemId: "", quantity: "", pricePerUnit: "",
    usePkg: false, pkgTypeId: "", pkgQty: "", sizePerPkg: "",
    pkgPriceMode: "per_unit", pricePerPkg: "",
    addingPkgType: false, newPkgTypeName: "",
  };
}

export default function PurchasesPage() {
  const { data: purchases, isLoading } = usePurchases();
  const { data: items } = useItems();
  const createPurchase = useCreatePurchase();
  const updatePurchase = useUpdatePurchase();
  const deletePurchase = useDeletePurchase();
  const queryClient = useQueryClient();
  const { data: packagingTypes = [] } = usePackagingTypes();
  const createPkgType = useCreatePackagingType();

  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  async function handleImportPurchases(rows: Record<string, unknown>[]) {
    setImporting(true);
    const supabase = (await import("@/lib/supabase/client")).createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let success = 0;
    const errors: string[] = [];
    for (const r of rows) {
      const itemName = String(r["nama_item"] ?? r["item"] ?? "").trim();
      const qty = Number(r["quantity"] ?? r["qty"] ?? 0);
      const total = Number(r["total_harga"] ?? r["total_price"] ?? 0);
      if (!itemName || qty <= 0 || total < 0) continue;
      const found = items?.find(
        (i) => i.name.toLowerCase() === itemName.toLowerCase(),
      );
      if (!found) {
        errors.push(`Bahan "${itemName}" tidak ditemukan`);
        continue;
      }
      const { error } = await supabase.rpc("record_purchase", {
        p_user_id: user!.id,
        p_item_id: found.id,
        p_quantity: qty,
        p_total_price: total,
        p_price_per_unit: total / qty,
      });
      if (error) errors.push(error.message);
      else success++;
    }
    setImporting(false);
    if (errors.length)
      toast.error(`${errors.length} baris gagal: ${errors[0]}`);
    if (success) {
      toast.success(`${success} pembelian berhasil diimpor`);
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
    }
  }

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [usePkg, setUsePkg] = useState(false);
  const [pkgTypeId, setPkgTypeId] = useState("");
  const [pkgQty, setPkgQty] = useState("");
  const [sizePerPkg, setSizePerPkg] = useState("");
  const [addingPkgType, setAddingPkgType] = useState(false);
  const [newPkgTypeName, setNewPkgTypeName] = useState("");
  const [pkgPriceMode, setPkgPriceMode] = useState<"per_unit" | "per_pkg">("per_unit");
  const [pricePerPkg, setPricePerPkg] = useState("");

  function openEdit(p: Purchase) {
    setEditing(p);
    setItemId("");
    setQuantity(String(p.quantity));
    setPricePerUnit(String(p.price_per_unit));
    setDate(new Date(p.created_at).toISOString().slice(0, 10));
    setUsePkg(!!(p.pkg_type_id));
    setPkgTypeId(p.pkg_type_id ?? "");
    setPkgQty(p.pkg_qty ? String(p.pkg_qty) : "");
    setSizePerPkg(p.size_per_pkg ? String(p.size_per_pkg) : "");
    setAddingPkgType(false);
    setNewPkgTypeName("");
    setModalOpen(true);
  }

  // ─── Multi-item create state ──────────────────────────────────────────────
  const [itemRows, setItemRows] = useState<PurchaseItemRow[]>([emptyItemRow()]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  function updateRow(key: string, patch: Partial<PurchaseItemRow>) {
    setItemRows((rows) => rows.map((r) => r._key === key ? { ...r, ...patch } : r));
  }
  function addRow() {
    const newRow = emptyItemRow();
    setItemRows((rows) => [...rows, newRow]);
    setExpandedKey(newRow._key);
  }
  function removeRow(key: string) {
    const next = itemRows.filter((r) => r._key !== key);
    const result = next.length ? next : [emptyItemRow()];
    setItemRows(result);
    if (key === expandedKey) setExpandedKey(result[0]._key);
  }

  function openCreate() {
    setEditing(null);
    const firstRow = emptyItemRow();
    setItemRows([firstRow]);
    setExpandedKey(firstRow._key);
    setDate(new Date().toISOString().slice(0, 10));
    setModalOpen(true);
  }

  const [search, setSearch] = useState("");
  const [filterItem, setFilterItem] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [pendingSortBy, setPendingSortBy] = useState("date_desc");
  const [pendingFilterItem, setPendingFilterItem] = useState("");
  const [pendingDateFrom, setPendingDateFrom] = useState("");
  const [pendingDateTo, setPendingDateTo] = useState("");

  const selectedItem = editing
    ? items?.find((i) => i.id === editing.item_id)
    : items?.find((i) => i.id === itemId);

  const effectiveQty = usePkg
    ? pkgQty && sizePerPkg ? Number(pkgQty) * Number(sizePerPkg) : 0
    : Number(quantity) || 0;

  const resolvedPricePerUnit = usePkg && pkgPriceMode === "per_pkg" && sizePerPkg && Number(sizePerPkg) > 0
    ? (pricePerPkg ? Number(pricePerPkg) / Number(sizePerPkg) : 0)
    : Number(pricePerUnit) || 0;

  const computedTotal = usePkg && pkgPriceMode === "per_pkg"
    ? (pkgQty && pricePerPkg ? Number(pkgQty) * Number(pricePerPkg) : 0)
    : (effectiveQty > 0 && pricePerUnit ? effectiveQty * Number(pricePerUnit) : 0);

  const avgPrice = selectedItem?.avg_price ?? 0;
  const priceDiff = resolvedPricePerUnit > 0 && avgPrice > 0 ? resolvedPricePerUnit - avgPrice : null;
  const pricePct = priceDiff !== null ? (priceDiff / avgPrice) * 100 : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (editing) {
      if (usePkg) {
        if (!pkgTypeId || !pkgQty || !sizePerPkg) return;
        if (Number(pkgQty) <= 0 || Number(sizePerPkg) <= 0) return;
        if (pkgPriceMode === "per_pkg" && (!pricePerPkg || Number(pricePerPkg) <= 0)) return;
        if (pkgPriceMode === "per_unit" && (!pricePerUnit || Number(pricePerUnit) <= 0)) return;
      } else {
        if (!quantity || Number(quantity) <= 0) return;
        if (!pricePerUnit || Number(pricePerUnit) <= 0) return;
      }
      const finalQtyEdit = usePkg ? Number(pkgQty) * Number(sizePerPkg) : Number(quantity);
      await updatePurchase.mutateAsync({
        id: editing.id,
        quantity: finalQtyEdit,
        price_per_unit: resolvedPricePerUnit,
        pkg_type_id: usePkg ? pkgTypeId || null : null,
        pkg_qty: usePkg ? Number(pkgQty) : null,
        size_per_pkg: usePkg ? Number(sizePerPkg) : null,
      });
    } else {
      // Multi-item create
      const validRows = itemRows.filter((r) => r.itemId);
      if (!validRows.length) return;

      // Validate all rows before submitting any
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        const label = `Baris ${i + 1}`;
        if (row.usePkg) {
          if (!row.pkgTypeId) {
            toast.error(`${label}: pilih jenis kemasan`);
            return;
          }
          if (!row.pkgQty || Number(row.pkgQty) <= 0) {
            toast.error(`${label}: jumlah kemasan harus diisi`);
            return;
          }
          if (!row.sizePerPkg || Number(row.sizePerPkg) <= 0) {
            toast.error(`${label}: isi per kemasan harus diisi`);
            return;
          }
        } else {
          if (!row.quantity || Number(row.quantity) <= 0) {
            toast.error(`${label}: jumlah harus diisi`);
            return;
          }
        }
        const rowPPUCheck = row.usePkg && row.pkgPriceMode === "per_pkg" && row.sizePerPkg && Number(row.sizePerPkg) > 0
          ? Number(row.pricePerPkg) / Number(row.sizePerPkg)
          : Number(row.pricePerUnit) || 0;
        if (!rowPPUCheck) {
          toast.error(`${label}: harga harus diisi`);
          return;
        }
      }

      for (const row of validRows) {
        const rowPPU = row.usePkg && row.pkgPriceMode === "per_pkg" && row.sizePerPkg && Number(row.sizePerPkg) > 0
          ? Number(row.pricePerPkg) / Number(row.sizePerPkg)
          : Number(row.pricePerUnit) || 0;
        const finalQty = row.usePkg
          ? Number(row.pkgQty) * Number(row.sizePerPkg)
          : Number(row.quantity);
        await createPurchase.mutateAsync({
          item_id: row.itemId,
          quantity: finalQty,
          price_per_unit: rowPPU,
          date,
          pkg_type_id: row.usePkg ? row.pkgTypeId || null : null,
          pkg_qty: row.usePkg ? Number(row.pkgQty) : null,
          size_per_pkg: row.usePkg ? Number(row.sizePerPkg) : null,
        });
      }
      setItemRows([emptyItemRow()]);
    }
    setModalOpen(false);
    setEditing(null);
    setDate(new Date().toISOString().slice(0, 10));
  }

  const filtered = useMemo(() => {
    let rows = purchases ?? [];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((p) =>
        ((p.item as any)?.name ?? "").toLowerCase().includes(q),
      );
    }
    if (filterItem) {
      rows = rows.filter((p) => p.item_id === filterItem);
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
    return [...rows].sort((a, b) => {
      switch (sortBy) {
        case "date_asc":
          return (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        case "price_desc":
          return b.total_price - a.total_price;
        case "price_asc":
          return a.total_price - b.total_price;
        case "qty_desc":
          return b.quantity - a.quantity;
        default:
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
      }
    });
  }, [purchases, search, filterItem, sortBy]);

  const hasFilters = search || filterItem || sortBy !== "date_desc" || filterDateFrom || filterDateTo;

  return (
    <AppLayout
      title="Pembelian"
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
                    <option value="date_desc">Terbaru</option>
                    <option value="date_asc">Terlama</option>
                    <option value="price_desc">Harga ↑</option>
                    <option value="price_asc">Harga ↓</option>
                    <option value="qty_desc">Qty terbanyak</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#7C6352] mb-1 block">Bahan</label>
                  <select
                    className={`${cls} w-full`}
                    value={pendingFilterItem}
                    onChange={(e) => setPendingFilterItem(e.target.value)}
                  >
                    <option value="">Semua bahan</option>
                    {items?.map((i) => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#7C6352] mb-1 block">Dari tanggal</label>
                  <input
                    type="date"
                    className={`${cls} w-full`}
                    value={pendingDateFrom}
                    onChange={(e) => setPendingDateFrom(e.target.value)}
                    max={pendingDateTo || undefined}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#7C6352] mb-1 block">Sampai tanggal</label>
                  <input
                    type="date"
                    className={`${cls} w-full`}
                    value={pendingDateTo}
                    onChange={(e) => setPendingDateTo(e.target.value)}
                    min={pendingDateFrom || undefined}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    setPendingSortBy("date_desc");
                    setPendingFilterItem("");
                    setPendingDateFrom("");
                    setPendingDateTo("");
                  }}
                  className="flex-1 h-9 rounded-lg border border-[#D9CCAF] text-sm text-[#7C6352] font-medium hover:bg-[#EDE4CF] transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={() => {
                    setSortBy(pendingSortBy);
                    setFilterItem(pendingFilterItem);
                    setFilterDateFrom(pendingDateFrom);
                    setFilterDateTo(pendingDateTo);
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
                placeholder="Cari bahan..."
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
                setPendingFilterItem(filterItem);
                setPendingDateFrom(filterDateFrom);
                setPendingDateTo(filterDateTo);
                setFilterSheetOpen(true);
              }}
              className={`relative h-9 px-3 rounded-lg border text-sm font-medium transition-colors flex items-center gap-1.5 ${
                (filterItem || sortBy !== "date_desc" || filterDateFrom || filterDateTo)
                  ? "border-[#A05035] bg-[#A05035]/10 text-[#A05035]"
                  : "border-[#D9CCAF] bg-[#FBF8F2] text-[#7C6352] hover:bg-[#EDE4CF]"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filter
              {(filterItem || sortBy !== "date_desc" || filterDateFrom || filterDateTo) && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#A05035] text-white text-[10px] flex items-center justify-center font-bold">
                  {[filterItem, sortBy !== "date_desc", filterDateFrom, filterDateTo].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>
          <div className="flex items-center justify-between text-xs text-[#B88D6A]">
            <span>
              {filtered.length} hasil
              {(purchases?.length ?? 0) > filtered.length &&
                ` dari ${purchases?.length}`}
            </span>
            {hasFilters && (
              <button
                onClick={() => {
                  setSearch("");
                  setFilterItem("");
                  setSortBy("date_desc");
                  setFilterDateFrom("");
                  setFilterDateTo("");
                  setPendingSortBy("date_desc");
                  setPendingFilterItem("");
                  setPendingDateFrom("");
                  setPendingDateTo("");
                }}
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
          ) : !purchases?.length ? (
            <EmptyState
              icon={ShoppingCart}
              title="Belum ada pembelian"
              description="Catat pembelian untuk mulai melacak biaya bahan."
              action={
                <Button size="sm" onClick={() => setModalOpen(true)}>
                  <Plus className="w-4 h-4" /> Tambah Pembelian
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#B88D6A]">
              Tidak ada hasil untuk filter ini
            </div>
          ) : (
            <>
              {/* Mobile card list */}
              <div className="sm:hidden divide-y divide-[#EDE4CF]">
                {filtered.map((p) => (
                  <div key={p.id} className="px-4 py-3 hover:bg-[#F5EFE0] transition-colors flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#2C1810] truncate">
                        {(p.item as any)?.name ?? "—"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-[#B88D6A]">{(p.item as any)?.unit}</span>
                        <span className="text-[10px] text-[#B88D6A]">·</span>
                        <span className="text-[10px] text-[#B88D6A]">{p.quantity} unit</span>
                        <span className="text-[10px] text-[#B88D6A]">·</span>
                        <span className="text-[10px] text-[#B88D6A]">{formatCurrency(p.price_per_unit)}/unit</span>
                      </div>
                      <p className="text-[10px] text-[#B88D6A] mt-0.5">
                        {format(new Date(p.created_at), "dd MMM yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[#2C1810] tabular-nums whitespace-nowrap">
                          {formatCurrency(p.total_price)}
                        </p>
                      </div>
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 rounded-lg text-[#B88D6A] hover:text-[#A05035] hover:bg-[#EDE4CF] transition-colors"
                        aria-label="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { if (confirm("Hapus pembelian ini?")) deletePurchase.mutate(p.id); }}
                        className="p-1.5 rounded-lg text-[#B88D6A] hover:text-red-500 hover:bg-red-50 transition-colors"
                        aria-label="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E5DACA]">
                      <th className="text-left px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">Bahan</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">Qty</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">Total</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">/Unit</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">Tanggal</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p.id} className="border-b border-[#EDE4CF] last:border-0 hover:bg-[#F5EFE0] transition-colors">
                        <td className="px-6 py-3 font-medium text-[#2C1810]">
                          <span className="line-clamp-1 text-sm">{(p.item as any)?.name ?? "—"}</span>
                          <span className="text-[10px] text-[#B88D6A]">{(p.item as any)?.unit}</span>
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums text-[#5C4535] text-sm">{p.quantity}</td>
                        <td className="px-6 py-3 text-right tabular-nums font-medium text-[#2C1810] text-sm whitespace-nowrap">{formatCurrency(p.total_price)}</td>
                        <td className="px-6 py-3 text-right tabular-nums text-[#5C4535] text-xs whitespace-nowrap">{formatCurrency(p.price_per_unit)}</td>
                        <td className="px-6 py-3 text-right text-[#B88D6A] text-xs whitespace-nowrap">{format(new Date(p.created_at), "dd MMM yyyy")}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-[#B88D6A] hover:text-[#A05035] hover:bg-[#EDE4CF] transition-colors" aria-label="Edit">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { if (confirm("Hapus pembelian ini?")) deletePurchase.mutate(p.id); }} className="p-1.5 rounded-lg text-[#B88D6A] hover:text-red-500 hover:bg-red-50 transition-colors" aria-label="Hapus">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Pembelian" : "Catat Pembelian"}
        size={editing ? "sm" : "md"}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {editing ? (
            // ── EDIT MODE (single item) ──────────────────────────────────────
            <>
              <div className="rounded-lg bg-[#F5EFE0] border border-[#D9CCAF] px-4 py-2.5">
                <p className="text-xs text-[#7C6352]">Bahan</p>
                <p className="text-sm font-medium text-[#2C1810]">
                  {(editing.item as any)?.name ?? "—"}{" "}
                  <span className="text-xs text-[#B88D6A]">({(editing.item as any)?.unit})</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input id="usePkg" type="checkbox" checked={usePkg}
                  onChange={(e) => { setUsePkg(e.target.checked); if (!e.target.checked) { setPkgTypeId(""); setPkgQty(""); setSizePerPkg(""); setAddingPkgType(false); setNewPkgTypeName(""); } }}
                  className="rounded border-[#D9CCAF] text-[#A05035] focus:ring-[#A05035]" />
                <label htmlFor="usePkg" className="text-sm text-[#4A3728] cursor-pointer">Beli per kemasan?</label>
                <HelpTip fieldId="purchase.usePkg" />
              </div>
              {usePkg ? (
                <div className="rounded-lg border border-[#D9CCAF] bg-[#F5EFE0] p-3 space-y-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-[#7C6352]">Jenis kemasan</label>
                    {addingPkgType ? (
                      <div className="flex flex-col gap-2">
                        <input autoFocus className="h-9 rounded-lg border border-[#D9CCAF] bg-[#FBF8F2] px-3 text-sm text-[#2C1810] w-full focus:outline-none focus:ring-2 focus:ring-[#A05035]"
                          placeholder="Nama kemasan baru..." value={newPkgTypeName} onChange={(e) => setNewPkgTypeName(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === "Enter") { e.preventDefault(); if (!newPkgTypeName.trim() || createPkgType.isPending) return; const newId = await createPkgType.mutateAsync(newPkgTypeName.trim()); setPkgTypeId(newId); setNewPkgTypeName(""); setAddingPkgType(false); }
                            if (e.key === "Escape") { setAddingPkgType(false); setNewPkgTypeName(""); }
                          }} />
                        <div className="flex gap-2">
                          <button type="button" onClick={async () => { if (!newPkgTypeName.trim()) return; const newId = await createPkgType.mutateAsync(newPkgTypeName.trim()); setPkgTypeId(newId); setNewPkgTypeName(""); setAddingPkgType(false); }} disabled={!newPkgTypeName.trim() || createPkgType.isPending} className="flex-1 h-9 rounded-lg bg-[#A05035] text-white text-sm disabled:opacity-50 hover:bg-[#8B4530] transition-colors">Tambah</button>
                          <button type="button" onClick={() => { setAddingPkgType(false); setNewPkgTypeName(""); }} className="flex-1 h-9 rounded-lg border border-[#D9CCAF] text-sm text-[#7C6352] hover:bg-[#EDE4CF] transition-colors">Batal</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <select className="h-9 flex-1 rounded-lg border border-[#D9CCAF] bg-[#FBF8F2] px-3 text-sm text-[#2C1810] focus:outline-none focus:ring-2 focus:ring-[#A05035]" value={pkgTypeId} onChange={(e) => setPkgTypeId(e.target.value)}>
                          <option value="">Pilih kemasan...</option>
                          {packagingTypes.map((pt) => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                        </select>
                        <button type="button" onClick={() => setAddingPkgType(true)} className="px-3 h-9 rounded-lg border border-[#A05035] text-[#A05035] text-sm hover:bg-[#A05035]/10 transition-colors">+ Tambah</button>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1"><label className="block text-xs font-medium text-[#7C6352] mb-1">Jumlah kemasan</label><input type="number" min="0.01" step="0.01" className="h-9 w-full rounded-lg border border-[#D9CCAF] bg-[#FBF8F2] px-3 text-sm text-[#2C1810] focus:outline-none focus:ring-2 focus:ring-[#A05035]" value={pkgQty} onChange={(e) => setPkgQty(e.target.value)} placeholder="5" /></div>
                    <span className="text-[#B88D6A] pb-2">×</span>
                    <div className="flex-1"><span className="flex items-center gap-1 mb-1"><label className="text-xs font-medium text-[#7C6352]">Isi per kemasan ({selectedItem?.unit ?? "unit"})</label><HelpTip fieldId="purchase.sizePerPkg" /></span><input type="number" min="0.01" step="0.01" className="h-9 w-full rounded-lg border border-[#D9CCAF] bg-[#FBF8F2] px-3 text-sm text-[#2C1810] focus:outline-none focus:ring-2 focus:ring-[#A05035]" value={sizePerPkg} onChange={(e) => setSizePerPkg(e.target.value)} placeholder="1000" /></div>
                  </div>
                  {pkgQty && sizePerPkg && <p className="text-xs text-[#5C4535]">→ Total qty: <span className="font-semibold">{Number(pkgQty) * Number(sizePerPkg)} {selectedItem?.unit}</span></p>}
                </div>
              ) : (
                <Input label={`Jumlah (${selectedItem?.unit ?? "unit"})`} type="number" min="0.01" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
              )}
              {usePkg && (
                <div className="flex gap-1 rounded-lg border border-[#D9CCAF] bg-[#F5EFE0] p-1">
                  <button type="button" onClick={() => { setPkgPriceMode("per_unit"); setPricePerPkg(""); }} className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${pkgPriceMode === "per_unit" ? "bg-white text-[#2C1810] shadow-sm" : "text-[#7C6352] hover:text-[#2C1810]"}`}>Harga per {selectedItem?.unit ?? "unit"}</button>
                  <button type="button" onClick={() => { setPkgPriceMode("per_pkg"); setPricePerUnit(""); }} className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${pkgPriceMode === "per_pkg" ? "bg-white text-[#2C1810] shadow-sm" : "text-[#7C6352] hover:text-[#2C1810]"}`}>Harga per kemasan</button>
                </div>
              )}
              {usePkg && pkgPriceMode === "per_pkg" ? (
                <Input label="Harga per kemasan (Rp)" type="text" inputMode="numeric" value={formatThousands(pricePerPkg)} onChange={(e) => setPricePerPkg(e.target.value.replace(/\./g, ""))} required />
              ) : (
                <Input label={`Harga per ${selectedItem?.unit ?? "unit"}`} type="text" inputMode="numeric" value={formatThousands(pricePerUnit)} onChange={(e) => setPricePerUnit(e.target.value.replace(/\./g, ""))} required />
              )}
              {computedTotal > 0 && (
                <div className="rounded-lg bg-[#737B4C]/10 border border-[#737B4C]/20 px-4 py-2.5 space-y-1">
                  <p className="text-xs text-[#5C6B38] font-medium">Total: <span className="font-bold">{formatCurrency(computedTotal)}</span></p>
                  {usePkg && pkgPriceMode === "per_pkg" && resolvedPricePerUnit > 0 && <p className="text-xs text-[#5C6B38]">= <span className="font-semibold">{formatCurrency(resolvedPricePerUnit)}</span> per {selectedItem?.unit ?? "unit"}</p>}
                  {priceDiff !== null && pricePct !== null && <p className={`text-xs font-medium ${priceDiff > 0 ? "text-red-600" : "text-green-700"}`}>{priceDiff > 0 ? "▲" : "▼"} {formatCurrency(Math.abs(priceDiff))} ({pricePct > 0 ? "+" : ""}{pricePct.toFixed(1)}%) vs avg harga</p>}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-[#4A3728] mb-1">Tanggal Transaksi</label>
                <input type="date" className={`${cls} w-full`} value={date} onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} required />
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={() => setModalOpen(false)} className="flex-1">Batal</Button>
                <Button type="submit" loading={updatePurchase.isPending} className="flex-1">Simpan</Button>
              </div>
            </>
          ) : (
            // ── CREATE MODE (multi-item) ─────────────────────────────────────
            <>
              <div>
                <label className="block text-sm font-medium text-[#4A3728] mb-1">Tanggal Transaksi</label>
                <input type="date" className={`${cls} w-full`} value={date} onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} required />
              </div>

              <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-0.5">
                {itemRows.map((row, idx) => {
                  const rowItem = items?.find((i) => i.id === row.itemId);
                  const rowEffQty = row.usePkg ? (row.pkgQty && row.sizePerPkg ? Number(row.pkgQty) * Number(row.sizePerPkg) : 0) : Number(row.quantity) || 0;
                  const rowPPU = row.usePkg && row.pkgPriceMode === "per_pkg" && row.sizePerPkg && Number(row.sizePerPkg) > 0 ? (row.pricePerPkg ? Number(row.pricePerPkg) / Number(row.sizePerPkg) : 0) : Number(row.pricePerUnit) || 0;
                  const rowTotal = row.usePkg && row.pkgPriceMode === "per_pkg" ? (row.pkgQty && row.pricePerPkg ? Number(row.pkgQty) * Number(row.pricePerPkg) : 0) : (rowEffQty > 0 && row.pricePerUnit ? rowEffQty * Number(row.pricePerUnit) : 0);
                  const rowAvg = rowItem?.avg_price ?? 0;
                  const rowDiff = rowPPU > 0 && rowAvg > 0 ? rowPPU - rowAvg : null;
                  const rowPct = rowDiff !== null ? (rowDiff / rowAvg) * 100 : null;
                  const u = (patch: Partial<PurchaseItemRow>) => updateRow(row._key, patch);
                  const isExpanded = row._key === expandedKey || itemRows.length === 1;
                  if (!isExpanded) {
                    return (
                      <div
                        key={row._key}
                        onClick={() => setExpandedKey(row._key)}
                        className="rounded-xl border border-[#D9CCAF] bg-[#FDFAF5] px-3 py-2.5 cursor-pointer hover:bg-[#F5EFE0] active:bg-[#EDE4CF] transition-colors flex items-center gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#7C6352] shrink-0">Item {idx + 1}</span>
                            {rowItem ? (
                              <span className="text-sm text-[#2C1810] truncate">{rowItem.name} ({rowItem.unit})</span>
                            ) : (
                              <span className="text-sm text-[#B88D6A]">Belum diisi</span>
                            )}
                          </div>
                          {rowTotal > 0 && <p className="text-xs text-[#5C6B38] mt-0.5 font-medium">{formatCurrency(rowTotal)}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <ChevronDown className="w-4 h-4 text-[#B88D6A]" />
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeRow(row._key); }}
                            className="text-[#B88D6A] hover:text-red-500 p-0.5 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={row._key} className="rounded-xl border border-[#D9CCAF] p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#7C6352]">Item {idx + 1}</span>
                        {itemRows.length > 1 && (
                          <button type="button" onClick={() => removeRow(row._key)} className="text-[#B88D6A] hover:text-red-500 p-0.5 transition-colors"><X className="w-4 h-4" /></button>
                        )}
                      </div>
                      <Select label="Bahan" value={row.itemId} onChange={(e) => u({ itemId: e.target.value, pricePerUnit: "", pricePerPkg: "" })} required>
                        <option value="">Pilih bahan...</option>
                        {items?.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                      </Select>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id={`pkg-${row._key}`} checked={row.usePkg}
                          onChange={(e) => u({ usePkg: e.target.checked, pkgTypeId: "", pkgQty: "", sizePerPkg: "", addingPkgType: false, newPkgTypeName: "" })}
                          className="rounded border-[#D9CCAF] text-[#A05035] focus:ring-[#A05035]" />
                        <label htmlFor={`pkg-${row._key}`} className="text-sm text-[#4A3728] cursor-pointer">Beli per kemasan?</label>
                        <HelpTip fieldId="purchase.usePkg" />
                      </div>
                      {row.usePkg ? (
                        <div className="rounded-lg border border-[#D9CCAF] bg-[#F5EFE0] p-3 space-y-3">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-[#7C6352]">Jenis kemasan</label>
                            {row.addingPkgType ? (
                              <div className="flex flex-col gap-2">
                                <input autoFocus className="h-9 rounded-lg border border-[#D9CCAF] bg-[#FBF8F2] px-3 text-sm text-[#2C1810] w-full focus:outline-none focus:ring-2 focus:ring-[#A05035]"
                                  placeholder="Nama kemasan baru..." value={row.newPkgTypeName} onChange={(e) => u({ newPkgTypeName: e.target.value })}
                                  onKeyDown={async (e) => {
                                    if (e.key === "Enter") { e.preventDefault(); if (!row.newPkgTypeName.trim() || createPkgType.isPending) return; const newId = await createPkgType.mutateAsync(row.newPkgTypeName.trim()); u({ pkgTypeId: newId, newPkgTypeName: "", addingPkgType: false }); }
                                    if (e.key === "Escape") u({ addingPkgType: false, newPkgTypeName: "" });
                                  }} />
                                <div className="flex gap-2">
                                  <button type="button" onClick={async () => { if (!row.newPkgTypeName.trim()) return; const newId = await createPkgType.mutateAsync(row.newPkgTypeName.trim()); u({ pkgTypeId: newId, newPkgTypeName: "", addingPkgType: false }); }} disabled={!row.newPkgTypeName.trim() || createPkgType.isPending} className="flex-1 h-9 rounded-lg bg-[#A05035] text-white text-sm disabled:opacity-50 hover:bg-[#8B4530] transition-colors">Tambah</button>
                                  <button type="button" onClick={() => u({ addingPkgType: false, newPkgTypeName: "" })} className="flex-1 h-9 rounded-lg border border-[#D9CCAF] text-sm text-[#7C6352] hover:bg-[#EDE4CF] transition-colors">Batal</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <select className="h-9 flex-1 rounded-lg border border-[#D9CCAF] bg-[#FBF8F2] px-3 text-sm text-[#2C1810] focus:outline-none focus:ring-2 focus:ring-[#A05035]" value={row.pkgTypeId} onChange={(e) => u({ pkgTypeId: e.target.value })}>
                                  <option value="">Pilih kemasan...</option>
                                  {packagingTypes.map((pt) => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                                </select>
                                <button type="button" onClick={() => u({ addingPkgType: true })} className="px-3 h-9 rounded-lg border border-[#A05035] text-[#A05035] text-sm hover:bg-[#A05035]/10 transition-colors">+ Tambah</button>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 items-end">
                            <div className="flex-1"><label className="block text-xs font-medium text-[#7C6352] mb-1">Jumlah kemasan</label><input type="number" min="0.01" step="0.01" className="h-9 w-full rounded-lg border border-[#D9CCAF] bg-[#FBF8F2] px-3 text-sm text-[#2C1810] focus:outline-none focus:ring-2 focus:ring-[#A05035]" value={row.pkgQty} onChange={(e) => u({ pkgQty: e.target.value })} placeholder="5" /></div>
                            <span className="text-[#B88D6A] pb-2">×</span>
                            <div className="flex-1"><span className="flex items-center gap-1 mb-1"><label className="text-xs font-medium text-[#7C6352]">Isi per kemasan ({rowItem?.unit ?? "unit"})</label><HelpTip fieldId="purchase.sizePerPkg" /></span><input type="number" min="0.01" step="0.01" className="h-9 w-full rounded-lg border border-[#D9CCAF] bg-[#FBF8F2] px-3 text-sm text-[#2C1810] focus:outline-none focus:ring-2 focus:ring-[#A05035]" value={row.sizePerPkg} onChange={(e) => u({ sizePerPkg: e.target.value })} placeholder="1000" /></div>
                          </div>
                          {row.pkgQty && row.sizePerPkg && <p className="text-xs text-[#5C4535]">→ Total qty: <span className="font-semibold">{Number(row.pkgQty) * Number(row.sizePerPkg)} {rowItem?.unit}</span></p>}
                        </div>
                      ) : (
                        <Input label={`Jumlah (${rowItem?.unit ?? "unit"})`} type="number" min="0.01" step="0.01" value={row.quantity} onChange={(e) => u({ quantity: e.target.value })} required />
                      )}
                      {row.usePkg && (
                        <div className="flex gap-1 rounded-lg border border-[#D9CCAF] bg-[#F5EFE0] p-1">
                          <button type="button" onClick={() => u({ pkgPriceMode: "per_unit", pricePerPkg: "" })} className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${row.pkgPriceMode === "per_unit" ? "bg-white text-[#2C1810] shadow-sm" : "text-[#7C6352] hover:text-[#2C1810]"}`}>Harga per {rowItem?.unit ?? "unit"}</button>
                          <button type="button" onClick={() => u({ pkgPriceMode: "per_pkg", pricePerUnit: "" })} className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${row.pkgPriceMode === "per_pkg" ? "bg-white text-[#2C1810] shadow-sm" : "text-[#7C6352] hover:text-[#2C1810]"}`}>Harga per kemasan</button>
                        </div>
                      )}
                      {row.usePkg && row.pkgPriceMode === "per_pkg" ? (
                        <Input label="Harga per kemasan (Rp)" type="text" inputMode="numeric" value={formatThousands(row.pricePerPkg)} onChange={(e) => u({ pricePerPkg: e.target.value.replace(/\./g, "") })} required />
                      ) : (
                        <Input label={`Harga per ${rowItem?.unit ?? "unit"}`} type="text" inputMode="numeric" value={formatThousands(row.pricePerUnit)} onChange={(e) => u({ pricePerUnit: e.target.value.replace(/\./g, "") })} required />
                      )}
                      {rowTotal > 0 && (
                        <div className="rounded-lg bg-[#737B4C]/10 border border-[#737B4C]/20 px-4 py-2.5 space-y-1">
                          <p className="text-xs text-[#5C6B38] font-medium">Total: <span className="font-bold">{formatCurrency(rowTotal)}</span></p>
                          {row.usePkg && row.pkgPriceMode === "per_pkg" && rowPPU > 0 && <p className="text-xs text-[#5C6B38]">= <span className="font-semibold">{formatCurrency(rowPPU)}</span> per {rowItem?.unit ?? "unit"}</p>}
                          {rowDiff !== null && rowPct !== null && <p className={`text-xs font-medium ${rowDiff > 0 ? "text-red-600" : "text-green-700"}`}>{rowDiff > 0 ? "▲" : "▼"} {formatCurrency(Math.abs(rowDiff))} ({rowPct > 0 ? "+" : ""}{rowPct.toFixed(1)}%) vs avg harga</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button type="button" onClick={addRow}
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl border border-dashed border-[#D9CCAF] text-sm text-[#7C6352] hover:border-[#A05035] hover:text-[#A05035] transition-colors">
                <Plus className="w-4 h-4" /> Tambah Item
              </button>

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={() => setModalOpen(false)} className="flex-1">Batal</Button>
                <Button type="submit" loading={createPurchase.isPending} className="flex-1">
                  Catat{itemRows.length > 1 ? ` (${itemRows.length} item)` : ""}
                </Button>
              </div>
            </>
          )}
        </form>
      </Modal>

      <ImportExcelModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Impor Pembelian"
        templateFilename="template_purchases.xlsx"
        templateColumns={["nama_item", "quantity", "total_harga"]}
        templateRows={[
          ["Tepung Terigu", 1000, 15000],
          ["Gula Pasir", 500, 8000],
        ]}
        previewColumns={[
          { key: "nama_item", label: "Nama Bahan" },
          { key: "quantity", label: "Qty" },
          { key: "total_harga", label: "Total Harga" },
        ]}
        onImport={handleImportPurchases}
        importing={importing}
      />
    </AppLayout>
  );
}
