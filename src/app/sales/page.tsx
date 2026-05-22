"use client";

export const dynamic = "force-dynamic";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useRecipes } from "@/hooks/useRecipes";
import { useAddonItems } from "@/hooks/useItems";
import { useAddonSubRecipes, useAddonFinishedRecipes } from "@/hooks/useRecipes";
import {
  useCreateSale,
  useCreateSaleCategory,
  useDeleteSale,
  useSaleCategories,
  useSales,
  useUpdateSale,
} from "@/hooks/useSales";
import { Sale } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { CheckCircle2, FileText, Filter, Minus, Pencil, Plus, Printer, Search, Share2, TrendingUp, Trash2, X } from "lucide-react";
import { useMemo, useEffect, useRef, useState } from "react";

const cls =
  "h-9 rounded-lg border border-[#D9CCAF] bg-[#FBF8F2] px-3 text-sm text-[#2C1810] placeholder:text-[#B88D6A] focus:outline-none focus:ring-2 focus:ring-[#A05035] focus:border-transparent";

interface ReceiptSnapshot {
  id: string;
  date: string;
  recipeName: string;
  categoryName: string;
  quantity: number;
  sellingPrice: number;
  addons: Array<{ name: string; qty: number; pricePerUnit: number }>;
}

interface AddonRow {
  sourceKey: string; // "item:uuid" or "sr:uuid"
  quantity: string;
  name: string;
  pricePerUnit: number;
}

export default function SalesPage() {
  const { data: sales, isLoading } = useSales();
  const { data: recipes } = useRecipes();
  const { data: categories } = useSaleCategories();
  const { data: addonItems } = useAddonItems();
  const { data: addonSubRecipes } = useAddonSubRecipes();
  const { data: addonFinishedRecipes } = useAddonFinishedRecipes();
  const createSale = useCreateSale();
  const updateSale = useUpdateSale();
  const deleteSale = useDeleteSale();
  const createCategory = useCreateSaleCategory();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [recipeId, setRecipeId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [sellingPrice, setSellingPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [addonRows, setAddonRows] = useState<AddonRow[]>([]);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptSnapshot | null>(null);
  const [invoiceSale, setInvoiceSale] = useState<Sale | null>(null);
  const [sharing, setSharing] = useState(false);
  const [storeName, setStoreName] = useState("Toko Anda");
  const receiptRef = useRef<HTMLDivElement>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.store_name) setStoreName(user.user_metadata.store_name);
    });
  }, []);

  const [search, setSearch] = useState("");
  const [filterRecipe, setFilterRecipe] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [pendingSortBy, setPendingSortBy] = useState("date_desc");
  const [pendingFilterRecipe, setPendingFilterRecipe] = useState("");
  const [pendingFilterCategory, setPendingFilterCategory] = useState("");

  const selectedRecipe = recipes?.find((r) => r.id === recipeId);
  const hpp = editing ? editing.hpp_at_sale : (selectedRecipe?.hpp ?? 0);

  const addonTotal = addonRows.reduce((sum, r) => {
    if (!r.sourceKey || !r.quantity) return sum;
    return sum + r.pricePerUnit * Number(r.quantity);
  }, 0);

  const totalRevenue = Number(sellingPrice) * Number(quantity);
  const hppProductTotal = hpp * Number(quantity);
  const hppAkhirTotal = hppProductTotal + addonTotal;
  const totalProfit = totalRevenue - hppAkhirTotal;
  const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  function addAddonRow() {
    setAddonRows((r) => [...r, { sourceKey: "", quantity: "1", name: "", pricePerUnit: 0 }]);
  }

  function removeAddonRow(i: number) {
    setAddonRows((r) => r.filter((_, idx) => idx !== i));
  }

  function selectAddonSource(i: number, sourceKey: string) {
    const [type, id] = sourceKey.split(":");
    let name = "";
    let pricePerUnit = 0;
    if (type === "item") {
      const item = addonItems?.find((x) => x.id === id);
      name = item?.name ?? "";
      pricePerUnit = item?.avg_price ?? 0;
    } else if (type === "sr") {
      const sr = addonSubRecipes?.find((x) => x.id === id) ?? addonFinishedRecipes?.find((x) => x.id === id);
      name = sr?.name ?? "";
      pricePerUnit = sr?.avg_price ?? 0;
    }
    setAddonRows((rows) =>
      rows.map((row, idx) =>
        idx === i ? { ...row, sourceKey, name, pricePerUnit } : row,
      ),
    );
  }

  function updateAddonQty(i: number, qty: string) {
    setAddonRows((rows) =>
      rows.map((row, idx) => (idx === i ? { ...row, quantity: qty } : row)),
    );
  }

  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    const cat = await createCategory.mutateAsync(newCatName.trim());
    setCategoryId(cat.id);
    setNewCatName("");
    setAddingCat(false);
  }

  function openCreate() {
    setEditing(null);
    setRecipeId("");
    setQuantity("1");
    setSellingPrice("");
    setCategoryId("");
    setNewCatName("");
    setAddingCat(false);
    setDate(new Date().toISOString().slice(0, 10));
    setAddonRows([]);
    setModalOpen(true);
  }

  function openEdit(s: Sale) {
    setEditing(s);
    setQuantity(String(s.quantity_sold));
    setSellingPrice(String(s.selling_price));
    setCategoryId(s.category_id ?? "");
    setNewCatName("");
    setAddingCat(false);
    setDate(new Date(s.created_at).toISOString().slice(0, 10));
    setAddonRows(
      (s.sale_addons ?? []).map((a) => ({
        sourceKey: a.item_id ? `item:${a.item_id}` : `sr:${a.sub_recipe_id}`,
        quantity: String(a.quantity),
        name: a.name_at_sale,
        pricePerUnit: a.price_per_unit_at_sale,
      })),
    );
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sellingPrice) return;

    const validAddons = addonRows
      .filter((r) => r.sourceKey && Number(r.quantity) > 0)
      .map((r) => {
        const [type, id] = r.sourceKey.split(":");
        return {
          item_id: type === "item" ? id : null,
          sub_recipe_id: type === "sr" ? id : null,
          quantity: Number(r.quantity),
          price_per_unit_at_sale: r.pricePerUnit,
          name_at_sale: r.name,
        };
      });

    if (editing) {
      await updateSale.mutateAsync({
        id: editing.id,
        quantity_sold: Number(quantity),
        selling_price: Number(sellingPrice),
        hpp_at_sale: editing.hpp_at_sale,
        category_id: categoryId || null,
        date,
        addons: validAddons,
      });
    } else {
      if (!recipeId) return;
      const sub_recipe_deductions = (selectedRecipe?.recipe_items ?? [])
        .filter((ri) => ri.sub_recipe_id)
        .map((ri) => ({
          sub_recipe_id: ri.sub_recipe_id!,
          quantity: ri.quantity_used * Number(quantity),
        }));
      const saleId = await createSale.mutateAsync({
        recipe_id: recipeId,
        quantity_sold: Number(quantity),
        selling_price: Number(sellingPrice),
        hpp_at_sale: hpp,
        category_id: categoryId || null,
        date,
        sub_recipe_deductions,
        addons: validAddons,
      });
      if (saleId) {
        setReceipt({
          id: saleId,
          date,
          recipeName: selectedRecipe?.name ?? "—",
          categoryName: categories?.find((c) => c.id === categoryId)?.name ?? "",
          quantity: Number(quantity),
          sellingPrice: Number(sellingPrice),
          addons: validAddons.map((a) => ({
            name: a.name_at_sale,
            qty: a.quantity,
            pricePerUnit: a.price_per_unit_at_sale,
          })),
        });
      }
    }
    closeModal();
    setRecipeId("");
    setQuantity("1");
    setSellingPrice("");
    setCategoryId("");
    setNewCatName("");
    setAddingCat(false);
    setDate(new Date().toISOString().slice(0, 10));
    setAddonRows([]);
  }

  // ─── Print / Share helpers ────────────────────────────────────────────────────
  function buildAddonRows(addons: Array<{ name: string; qty: number; pricePerUnit: number }>) {
    return addons.map((a) =>
      `<tr><td style="padding:3px 0 3px 20px;font-size:10pt;color:#7C6352">+ ${a.name} (${a.qty}×)<br><span style="font-size:9pt;color:#B88D6A">@ ${formatCurrency(a.pricePerUnit)}</span></td><td style="text-align:right;font-size:10pt;color:#7C6352;white-space:nowrap;vertical-align:top;padding:3px 0">${formatCurrency(a.qty * a.pricePerUnit)}</td></tr>`
    ).join("");
  }

  function buildAddonRowsThermal(addons: Array<{ name: string; qty: number; pricePerUnit: number }>) {
    return addons.map((a) =>
      `<tr><td style="font-size:8pt;padding:1mm 0 1mm 6mm;opacity:.8">+ ${a.name} (${a.qty}×)<br><span style="font-size:7.5pt">@ ${formatCurrency(a.pricePerUnit)}</span></td><td style="text-align:right;font-size:8pt;white-space:nowrap;vertical-align:top;opacity:.8">${formatCurrency(a.qty * a.pricePerUnit)}</td></tr>`
    ).join("");
  }

  function openPrintWindow(html: string) {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  }

  function buildStrokHtml(opts: { subtitle: string; date: string; txId?: string; mainRow: string; addonRows: string; total: number }) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Struk - ${storeName}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#fdf6ee;min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:24px}.card{background:#fff;border-radius:16px;max-width:400px;width:100%;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.15)}.hdr{background:#fdf6ee;padding:20px 20px 16px;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}.store-name{font-size:18pt;font-weight:700;color:#2C1810;margin-bottom:3px}.brand{font-size:9pt;color:#B88D6A;margin-bottom:2px}.sub{font-size:9pt;color:#92400e;margin-bottom:2px}.txid{font-size:7pt;color:#b45309;font-family:monospace;margin-top:4px}.body{padding:20px}table{width:100%;border-collapse:collapse;margin-bottom:4px}tr{border-bottom:1px solid #fef3c7}tr:last-child{border-bottom:none}td{padding:7px 0;font-size:10pt;vertical-align:top;color:#78350f}td.r{text-align:right;white-space:nowrap;color:#92400e}.div{border:none;border-top:2px dashed #fde68a;margin:12px 0}.total{display:flex;justify-content:space-between;align-items:center;margin-top:4px}.total-label{font-size:12pt;font-weight:700;color:#b45309}.total-amt{font-size:20pt;font-weight:700;color:#78350f;font-variant-numeric:tabular-nums}@media print{body{background:#fff;padding:0}.card{box-shadow:none;border-radius:0}.hdr{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
<div class="card"><div class="hdr">
<p class="store-name">${opts.subtitle !== storeName ? opts.subtitle : storeName}</p>
<p class="brand">Tata Data Dapur</p>
<p class="sub">${opts.date}</p>${opts.txId ? `<p class="txid">#${opts.txId}</p>` : ""}
</div><div class="body"><table>${opts.mainRow}${opts.addonRows}</table>
<hr class="div"><div class="total"><span class="total-label">Total</span><span class="total-amt">${formatCurrency(opts.total)}</span></div>
</div></div><script>window.onload=function(){window.print()}<\/script></body></html>`;
  }

  function buildThermalHtml(opts: { subtitle: string; date: string; txId?: string; mainRow: string; addonRows: string; total: number }) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Kasir - ${storeName}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}@page{size:58mm auto;margin:4mm 3mm}body{font-family:"Courier New",Courier,monospace;font-size:9pt;color:#000;width:52mm}h1{font-size:12pt;font-weight:700;text-align:center;margin-bottom:0.5mm}h2{font-size:8pt;font-weight:400;text-align:center;margin-bottom:1mm;opacity:.6}.sub{font-size:8pt;text-align:center;margin-bottom:0.5mm}.txid{font-size:7pt;text-align:center;margin-bottom:3mm;opacity:.7}.div-solid{border-top:1px solid #000;margin:2mm 0}.div-dash{border-top:1px dashed #000;margin:2mm 0}table{width:100%;border-collapse:collapse}td{font-size:8.5pt;padding:1.5mm 0;vertical-align:top}td.r{text-align:right;white-space:nowrap}.total-row{display:flex;justify-content:space-between;align-items:baseline;margin-top:1mm}.total-label{font-size:9pt;font-weight:700}.total-amt{font-size:13pt;font-weight:700}.footer{text-align:center;font-size:7pt;margin-top:4mm;opacity:.6}@media print{body{width:auto}}</style></head><body>
<h1>${storeName}</h1><h2>Tata Data Dapur</h2>
<p class="sub">${opts.date}</p>${opts.txId ? `<p class="txid">#${opts.txId}</p>` : ""}
<div class="div-solid"></div><table>${opts.mainRow}${opts.addonRows}</table>
<div class="div-dash"></div><div class="total-row"><span class="total-label">TOTAL</span><span class="total-amt">${formatCurrency(opts.total)}</span></div>
<div class="div-solid"></div><p class="footer">Terima kasih</p>
<script>window.onload=function(){window.print()}<\/script></body></html>`;
  }

  function printReceipt(r: ReceiptSnapshot, thermal: boolean) {
    const mainRow = `<tr><td style="font-size:11pt;color:#2C1810;padding:7px 0"><strong>${r.quantity}×</strong> ${r.recipeName}</td><td style="text-align:right;font-size:11pt;color:#2C1810;white-space:nowrap;vertical-align:top;padding:7px 0">${formatCurrency(r.sellingPrice * r.quantity)}</td></tr>`;
    const mainRowT = `<tr><td style="font-size:8.5pt;padding:1.5mm 0"><strong>${r.quantity}×</strong> ${r.recipeName}</td><td class="r" style="font-size:8.5pt;padding:1.5mm 0">${formatCurrency(r.sellingPrice * r.quantity)}</td></tr>`;
    const aRows = buildAddonRows(r.addons);
    const aRowsT = buildAddonRowsThermal(r.addons);
    const total = r.sellingPrice * r.quantity;
    const opts = { subtitle: storeName, date: format(new Date(r.date), "dd MMM yyyy"), txId: r.id.slice(0, 8).toUpperCase(), total };
    openPrintWindow(thermal ? buildThermalHtml({ ...opts, mainRow: mainRowT, addonRows: aRowsT }) : buildStrokHtml({ ...opts, mainRow, addonRows: aRows }));
  }

  function printInvoice(s: Sale, thermal: boolean) {
    const recipeName = (s.recipe as any)?.name ?? "—";
    const total = s.selling_price * s.quantity_sold;
    const addons = (s.sale_addons ?? []).map((a) => ({ name: a.name_at_sale, qty: a.quantity, pricePerUnit: a.price_per_unit_at_sale }));
    const mainRow = `<tr><td style="font-size:11pt;color:#2C1810;padding:7px 0"><strong>${s.quantity_sold}×</strong> ${recipeName}</td><td style="text-align:right;font-size:11pt;color:#2C1810;white-space:nowrap;vertical-align:top;padding:7px 0">${formatCurrency(total)}</td></tr>`;
    const mainRowT = `<tr><td style="font-size:8.5pt;padding:1.5mm 0"><strong>${s.quantity_sold}×</strong> ${recipeName}</td><td class="r" style="font-size:8.5pt;padding:1.5mm 0">${formatCurrency(total)}</td></tr>`;
    const aRows = buildAddonRows(addons);
    const aRowsT = buildAddonRowsThermal(addons);
    const opts = { subtitle: storeName, date: format(new Date(s.created_at), "dd MMM yyyy"), txId: s.id.slice(0, 8).toUpperCase(), total };
    openPrintWindow(thermal ? buildThermalHtml({ ...opts, mainRow: mainRowT, addonRows: aRowsT }) : buildStrokHtml({ ...opts, mainRow, addonRows: aRows }));
  }

  async function captureAndShare(ref: React.RefObject<HTMLDivElement | null>, filename: string, title: string, fallbackFn: () => void) {
    try {
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(ref.current!, { quality: 0.95, pixelRatio: 3, backgroundColor: "#ffffff" });
      if (!blob) throw new Error("toBlob failed");
      const file = new File([blob], filename, { type: "image/jpeg" });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      fallbackFn();
    }
  }

  async function handleShareReceipt() {
    if (!receipt) return;
    setSharing(true);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r as FrameRequestCallback)));
    await captureAndShare(receiptRef, `struk-${receipt.id.slice(0, 8)}.jpg`, "Struk Transaksi", () => printReceipt(receipt, false));
    setSharing(false);
  }

  async function handleShareInvoice() {
    if (!invoiceSale) return;
    setSharing(true);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r as FrameRequestCallback)));
    await captureAndShare(invoiceRef, `invoice-${invoiceSale.id.slice(0, 8)}.jpg`, "Invoice Transaksi", () => printInvoice(invoiceSale, false));
    setSharing(false);
  }

  const filtered = useMemo(() => {
    let rows = sales ?? [];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((s) =>
        ((s.recipe as any)?.name ?? "").toLowerCase().includes(q),
      );
    }
    if (filterRecipe) {
      rows = rows.filter((s) => s.recipe_id === filterRecipe);
    }
    if (filterCategory) {
      rows = rows.filter((s) => s.category_id === filterCategory);
    }
    return [...rows].sort((a, b) => {
      const profitA = (a.selling_price * a.quantity_sold) - (a.hpp_at_sale * a.quantity_sold + (a.hpp_addons_at_sale ?? 0));
      const profitB = (b.selling_price * b.quantity_sold) - (b.hpp_at_sale * b.quantity_sold + (b.hpp_addons_at_sale ?? 0));
      const revenueA = a.selling_price * a.quantity_sold;
      const revenueB = b.selling_price * b.quantity_sold;
      switch (sortBy) {
        case "date_asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "profit_desc":
          return profitB - profitA;
        case "profit_asc":
          return profitA - profitB;
        case "revenue_desc":
          return revenueB - revenueA;
        case "qty_desc":
          return b.quantity_sold - a.quantity_sold;
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [sales, search, filterRecipe, filterCategory, sortBy]);

  const hasFilters =
    search || filterRecipe || filterCategory || sortBy !== "date_desc";

  return (
    <AppLayout
      title="Penjualan"
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
                    <option value="profit_desc">Laba ↑</option>
                    <option value="profit_asc">Laba ↓</option>
                    <option value="revenue_desc">Pendapatan ↑</option>
                    <option value="qty_desc">Qty terbanyak</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#7C6352] mb-1 block">Kategori</label>
                  <select
                    className={`${cls} w-full`}
                    value={pendingFilterCategory}
                    onChange={(e) => setPendingFilterCategory(e.target.value)}
                  >
                    <option value="">Semua kategori</option>
                    {categories?.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#7C6352] mb-1 block">Produk</label>
                  <select
                    className={`${cls} w-full`}
                    value={pendingFilterRecipe}
                    onChange={(e) => setPendingFilterRecipe(e.target.value)}
                  >
                    <option value="">Semua produk</option>
                    {recipes?.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    setPendingSortBy("date_desc");
                    setPendingFilterRecipe("");
                    setPendingFilterCategory("");
                  }}
                  className="flex-1 h-9 rounded-lg border border-[#D9CCAF] text-sm text-[#7C6352] font-medium hover:bg-[#EDE4CF] transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={() => {
                    setSortBy(pendingSortBy);
                    setFilterRecipe(pendingFilterRecipe);
                    setFilterCategory(pendingFilterCategory);
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
                placeholder="Cari produk..."
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
                setPendingFilterRecipe(filterRecipe);
                setPendingFilterCategory(filterCategory);
                setFilterSheetOpen(true);
              }}
              className={`relative h-9 px-3 rounded-lg border text-sm font-medium transition-colors flex items-center gap-1.5 ${
                (filterRecipe || filterCategory || sortBy !== "date_desc")
                  ? "border-[#A05035] bg-[#A05035]/10 text-[#A05035]"
                  : "border-[#D9CCAF] bg-[#FBF8F2] text-[#7C6352] hover:bg-[#EDE4CF]"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filter
              {(filterRecipe || filterCategory || sortBy !== "date_desc") && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#A05035] text-white text-[10px] flex items-center justify-center font-bold">
                  {[filterRecipe, filterCategory, sortBy !== "date_desc"].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>
          <div className="flex items-center justify-between text-xs text-[#B88D6A]">
            <span>
              {filtered.length} hasil
              {(sales?.length ?? 0) > filtered.length &&
                ` dari ${sales?.length}`}
            </span>
            {hasFilters && (
              <button
                onClick={() => {
                  setSearch("");
                  setFilterRecipe("");
                  setFilterCategory("");
                  setSortBy("date_desc");
                  setPendingSortBy("date_desc");
                  setPendingFilterRecipe("");
                  setPendingFilterCategory("");
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
          ) : !sales?.length ? (
            <EmptyState
              icon={TrendingUp}
              title="Belum ada penjualan"
              description="Catat penjualan untuk mulai melacak pendapatan dan laba."
              action={
                <Button size="sm" onClick={openCreate}>
                  <Plus className="w-4 h-4" /> Catat Penjualan
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
                {filtered.map((s) => {
                  const revenue = s.selling_price * s.quantity_sold;
                  const hppTotal = s.hpp_at_sale * s.quantity_sold + (s.hpp_addons_at_sale ?? 0);
                  const saleProfit = revenue - hppTotal;
                  const saleMargin = revenue > 0 ? (saleProfit / revenue) * 100 : 0;
                  const hasAddons = (s.hpp_addons_at_sale ?? 0) > 0;
                  const isExpanded = expandedSaleId === s.id;

                  return (
                    <div key={s.id} className="px-4 py-3 hover:bg-[#F5EFE0] transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[#2C1810] truncate">
                            {(s.recipe as any)?.name ?? "—"}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {(s as any).category ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#EDE4CF] text-[#5C4535]">
                                {(s as any).category.name}
                              </span>
                            ) : null}
                            <span className="text-[10px] text-[#B88D6A]">{format(new Date(s.created_at), "dd MMM yyyy")}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <div className="text-right mr-1">
                            <p className={`text-sm font-semibold tabular-nums whitespace-nowrap ${saleProfit >= 0 ? "text-[#737B4C]" : "text-red-600"}`}>
                              {formatCurrency(saleProfit)}
                            </p>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded tabular-nums ${saleMargin >= 30 ? "text-[#5C6B38]" : saleMargin >= 15 ? "text-[#7C563D]" : "text-red-600"}`}>
                              {saleMargin.toFixed(1)}%
                            </span>
                          </div>
                          <button onClick={() => setInvoiceSale(s)} className="p-1.5 rounded-lg text-[#B88D6A] hover:text-[#A05035] hover:bg-[#EDE4CF] transition-colors" aria-label="Invoice">
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-[#B88D6A] hover:text-[#A05035] hover:bg-[#EDE4CF] transition-colors" aria-label="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { if (confirm("Hapus penjualan ini?")) deleteSale.mutate(s.id); }} className="p-1.5 rounded-lg text-[#B88D6A] hover:text-red-500 hover:bg-red-50 transition-colors" aria-label="Hapus">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-[#B88D6A] tabular-nums flex-wrap">
                        <span>{s.quantity_sold}×</span>
                        <span>{formatCurrency(s.selling_price)}/unit</span>
                        <span>·</span>
                        <button
                          onClick={() => setExpandedSaleId(isExpanded ? null : s.id)}
                          className={`${hasAddons ? "text-[#A05035] font-medium" : ""} hover:underline`}
                        >
                          HPP Akhir {formatCurrency(hppTotal)}
                          {hasAddons && " ▾"}
                        </button>
                      </div>
                      {isExpanded && hasAddons && (
                        <div className="mt-2 rounded-lg bg-[#F5EFE0] border border-[#E5DACA] px-3 py-2 text-[10px] space-y-1">
                          <div className="flex justify-between text-[#7C6352]">
                            <span>HPP Produk</span>
                            <span className="tabular-nums">{formatCurrency(s.hpp_at_sale * s.quantity_sold)}</span>
                          </div>
                          {(s.sale_addons ?? []).map((a) => (
                            <div key={a.id} className="flex justify-between text-[#7C6352]">
                              <span>+ {a.name_at_sale} ({a.quantity}×)</span>
                              <span className="tabular-nums">{formatCurrency(a.quantity * a.price_per_unit_at_sale)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between font-semibold text-[#2C1810] border-t border-[#D9CCAF] pt-1">
                            <span>HPP Akhir</span>
                            <span className="tabular-nums">{formatCurrency(hppTotal)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E5DACA]">
                      <th className="text-left px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">Produk</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">Kategori</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">Qty</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">Harga Jual</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">HPP Akhir</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">Laba</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">Margin</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">Tanggal</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => {
                      const revenue = s.selling_price * s.quantity_sold;
                      const hppTotal = s.hpp_at_sale * s.quantity_sold + (s.hpp_addons_at_sale ?? 0);
                      const saleProfit = revenue - hppTotal;
                      const saleMargin = revenue > 0 ? (saleProfit / revenue) * 100 : 0;
                      const hasAddons = (s.hpp_addons_at_sale ?? 0) > 0;
                      const isExpanded = expandedSaleId === s.id;

                      return (
                        <>
                          <tr key={s.id} className="border-b border-[#EDE4CF] last:border-0 hover:bg-[#F5EFE0] transition-colors">
                            <td className="px-6 py-3 font-medium text-[#2C1810]">
                              <span className="line-clamp-1 text-sm">{(s.recipe as any)?.name ?? "—"}</span>
                            </td>
                            <td className="px-6 py-3">
                              {(s as any).category ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#EDE4CF] text-[#5C4535]">{(s as any).category.name}</span>
                              ) : (
                                <span className="text-xs text-[#D9CCAF]">—</span>
                              )}
                            </td>
                            <td className="px-6 py-3 text-right tabular-nums text-[#5C4535] text-sm">{s.quantity_sold}</td>
                            <td className="px-6 py-3 text-right tabular-nums text-[#4A3728] text-xs whitespace-nowrap">{formatCurrency(s.selling_price)}</td>
                            <td className="px-6 py-3 text-right tabular-nums text-[#4A3728] text-xs whitespace-nowrap">
                              {hasAddons ? (
                                <button
                                  onClick={() => setExpandedSaleId(isExpanded ? null : s.id)}
                                  className="text-[#A05035] hover:underline tabular-nums"
                                  title="Klik untuk lihat breakdown"
                                >
                                  {formatCurrency(hppTotal)} ▾
                                </button>
                              ) : (
                                formatCurrency(hppTotal)
                              )}
                            </td>
                            <td className={`px-6 py-3 text-right tabular-nums font-semibold text-sm whitespace-nowrap ${saleProfit >= 0 ? "text-[#737B4C]" : "text-red-600"}`}>
                              {formatCurrency(saleProfit)}
                            </td>
                            <td className="px-6 py-3 text-right">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${saleMargin >= 30 ? "bg-[#737B4C]/10 text-[#5C6B38]" : saleMargin >= 15 ? "bg-[#B88D6A]/10 text-[#7C563D]" : "bg-red-50 text-red-700"}`}>
                                {saleMargin.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-6 py-3 text-right text-[#B88D6A] text-xs whitespace-nowrap">
                              {format(new Date(s.created_at), "dd MMM yyyy")}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1">
                                <button onClick={() => setInvoiceSale(s)} className="p-1.5 rounded-lg text-[#B88D6A] hover:text-[#A05035] hover:bg-[#EDE4CF] transition-colors" aria-label="Invoice">
                                  <FileText className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-[#B88D6A] hover:text-[#A05035] hover:bg-[#EDE4CF] transition-colors" aria-label="Edit">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => { if (confirm("Hapus penjualan ini?")) deleteSale.mutate(s.id); }} className="p-1.5 rounded-lg text-[#B88D6A] hover:text-red-500 hover:bg-red-50 transition-colors" aria-label="Hapus">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && hasAddons && (
                            <tr className="bg-[#F5EFE0] border-b border-[#E5DACA]">
                              <td colSpan={9} className="px-6 py-2">
                                <div className="text-xs text-[#7C6352] space-y-1">
                                  <div className="flex gap-8">
                                    <span>HPP Produk: <span className="font-medium tabular-nums">{formatCurrency(s.hpp_at_sale * s.quantity_sold)}</span></span>
                                    {(s.sale_addons ?? []).map((a) => (
                                      <span key={a.id}>
                                        + {a.name_at_sale} ({a.quantity}×): <span className="font-medium tabular-nums">{formatCurrency(a.quantity * a.price_per_unit_at_sale)}</span>
                                      </span>
                                    ))}
                                    <span className="font-semibold text-[#2C1810]">
                                      HPP Akhir: <span className="tabular-nums">{formatCurrency(hppTotal)}</span>
                                    </span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? "Edit Penjualan" : "Catat Penjualan"}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {editing ? (
            <div className="rounded-lg bg-[#F5EFE0] border border-[#D9CCAF] px-4 py-2.5">
              <p className="text-xs text-[#7C6352]">Produk</p>
              <p className="text-sm font-medium text-[#2C1810]">
                {(editing.recipe as any)?.name ?? "—"}
              </p>
            </div>
          ) : (
            <Select
              label="Produk"
              value={recipeId}
              onChange={(e) => setRecipeId(e.target.value)}
              required
            >
              <option value="">Pilih produk...</option>
              {recipes?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — HPP {formatCurrency(r.hpp)}
                </option>
              ))}
            </Select>
          )}

          {/* Add-On section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[#4A3728]">Add-On</label>
              <button
                type="button"
                onClick={addAddonRow}
                className="text-xs text-[#A05035] hover:underline font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Tambah Add-On
              </button>
            </div>
            {addonRows.length > 0 && (
              <div className="space-y-2">
                {addonRows.map((row, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <div className="flex-1">
                      <select
                        className={`${cls} w-full`}
                        value={row.sourceKey}
                        onChange={(e) => selectAddonSource(i, e.target.value)}
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
                        value={row.quantity}
                        onChange={(e) => updateAddonQty(i, e.target.value)}
                        className={`${cls} w-full`}
                        required
                      />
                    </div>
                    {row.sourceKey && Number(row.quantity) > 0 && (
                      <span className="text-xs text-[#7C6352] whitespace-nowrap tabular-nums">
                        {formatCurrency(row.pricePerUnit * Number(row.quantity))}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAddonRow(i)}
                      className="p-1.5 rounded text-[#D9CCAF] hover:text-red-500 flex-shrink-0"
                      aria-label="Hapus add-on"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {addonTotal > 0 && (
                  <div className="text-xs text-[#7C6352] text-right">
                    Total add-on: <span className="font-semibold tabular-nums">{formatCurrency(addonTotal)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-[#4A3728]">
                Kategori
              </label>
              {!addingCat && (
                <button
                  type="button"
                  onClick={() => setAddingCat(true)}
                  className="text-xs text-[#A05035] hover:underline font-medium flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Kategori baru
                </button>
              )}
            </div>
            {addingCat ? (
              <div className="flex gap-2">
                <input
                  className={`${cls} flex-1`}
                  placeholder="Nama kategori..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddCategory}
                  loading={createCategory.isPending}
                >
                  Simpan
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setAddingCat(false)}
                >
                  Batal
                </Button>
              </div>
            ) : (
              <Select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Tanpa kategori</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <Input
            label="Jumlah Terjual"
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
          {(() => {
            const hppPerUnit = hpp + (Number(quantity) > 0 ? addonTotal / Number(quantity) : 0);
            return (
              <div>
                <Input
                  label="Harga Jual per Unit (Rp)"
                  type="number"
                  min="0"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  required
                  placeholder={hppPerUnit > 0 ? String(Math.ceil(hppPerUnit)) : undefined}
                />
                {hppPerUnit > 0 && (
                  <p className="text-xs text-[#B88D6A] mt-1">
                    HPP Akhir/unit: <span className="font-medium tabular-nums">{formatCurrency(hppPerUnit)}</span>
                  </p>
                )}
              </div>
            );
          })()}
          <div>
            <label className="block text-sm font-medium text-[#4A3728] mb-1">Tanggal Transaksi</label>
            <input
              type="date"
              className={`${cls} w-full`}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              required
            />
          </div>
          {(editing || selectedRecipe) && Number(sellingPrice) > 0 && (
            <div
              className={`rounded-lg px-4 py-3 border text-xs space-y-1 ${totalProfit >= 0 ? "bg-[#737B4C]/10 border-[#737B4C]/20" : "bg-red-50 border-red-100"}`}
            >
              <div className="flex justify-between">
                <span className="text-[#5C4535]">Pendapatan</span>
                <span className="font-semibold tabular-nums">{formatCurrency(totalRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5C4535]">HPP Produk</span>
                <span className="tabular-nums">{formatCurrency(hppProductTotal)}</span>
              </div>
              {addonTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#5C4535]">Add-On</span>
                  <span className="tabular-nums">{formatCurrency(addonTotal)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#5C4535] font-medium">HPP Akhir</span>
                <span className="font-medium tabular-nums">{formatCurrency(hppAkhirTotal)}</span>
              </div>
              <div
                className={`flex justify-between font-bold border-t pt-1 ${totalProfit >= 0 ? "border-[#737B4C]/30 text-[#5C6B38]" : "border-red-200 text-red-700"}`}
              >
                <span>Laba</span>
                <span className="tabular-nums">
                  {formatCurrency(totalProfit)} ({margin.toFixed(1)}%)
                </span>
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={closeModal}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              type="submit"
              loading={createSale.isPending || updateSale.isPending}
              className="flex-1"
            >
              {editing ? "Simpan" : "Catat"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Receipt Modal (setelah save) ────────────────────────────────────────── */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setReceipt(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="w-10 h-1 rounded-full bg-[#D9CCAF]" /></div>
            <div className="flex items-center justify-between px-5 py-3 shrink-0">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 size={16} />
                <span className="text-sm font-semibold">Transaksi Tersimpan</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => printReceipt(receipt, false)} className="flex items-center gap-1.5 text-xs font-medium text-[#7C6352] bg-[#FBF8F2] border border-[#D9CCAF] rounded-lg px-3 py-1.5">
                  <Printer size={13} /> Struk
                </button>
                <button onClick={() => printReceipt(receipt, true)} className="flex items-center gap-1.5 text-xs font-medium text-[#7C6352] bg-[#FBF8F2] border border-[#D9CCAF] rounded-lg px-3 py-1.5">
                  <Printer size={13} /> Kasir
                </button>
                <button onClick={handleShareReceipt} disabled={sharing} className="flex items-center gap-1.5 text-xs font-medium text-[#7C6352] bg-[#FBF8F2] border border-[#D9CCAF] rounded-lg px-3 py-1.5 disabled:opacity-50">
                  {sharing ? "..." : <><Share2 size={13} /> Kirim</>}
                </button>
                <button onClick={() => setReceipt(null)} className="p-1.5 text-[#B88D6A] hover:text-[#7C6352] rounded-lg"><X size={16} /></button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              <div ref={receiptRef} style={{ padding: "16px 16px 24px", backgroundColor: "#fdf6ee" }}>
                <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #D9CCAF" }}>
                  <div style={{ backgroundColor: "#FBF8F2", padding: "16px 20px", textAlign: "center" }}>
                    <p style={{ fontSize: 20, fontWeight: 700, color: "#2C1810", marginBottom: 2 }}>{storeName}</p>
                    <p style={{ fontSize: 10, color: "#B88D6A", marginBottom: 4 }}>Tata Data Dapur</p>
                    <p style={{ fontSize: 11, color: "#7C6352" }}>{format(new Date(receipt.date), "dd MMM yyyy")}</p>
                    {receipt.categoryName && <p style={{ fontSize: 10, color: "#B88D6A", marginTop: 2 }}>{receipt.categoryName}</p>}
                  </div>
                  <div style={{ backgroundColor: "#fff", padding: "16px 20px" }}>
                    <div style={{ paddingBottom: 10, borderBottom: "1px solid #F5EFE0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <span style={{ fontSize: 14, color: "#2C1810", fontWeight: 600 }}>{receipt.quantity}× {receipt.recipeName}</span>
                        <span style={{ fontSize: 14, color: "#2C1810", fontWeight: 600, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(receipt.sellingPrice * receipt.quantity)}</span>
                      </div>
                      {receipt.addons.map((a, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", marginTop: 4, paddingLeft: 16 }}>
                          <span style={{ fontSize: 11, color: "#7C6352" }}>+ {a.name} ({a.qty}×)<br /><span style={{ fontSize: 10, color: "#B88D6A" }}>@ {formatCurrency(a.pricePerUnit)}</span></span>
                          <span style={{ fontSize: 11, color: "#7C6352", whiteSpace: "nowrap" }}>{formatCurrency(a.qty * a.pricePerUnit)}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ borderTop: "2px dashed #D9CCAF", marginTop: 12, marginBottom: 12 }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#7C6352" }}>Total</span>
                      <span style={{ fontSize: 22, fontWeight: 700, color: "#2C1810" }}>{formatCurrency(receipt.sellingPrice * receipt.quantity)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Invoice Modal (dari riwayat) ────────────────────────────────────────── */}
      {invoiceSale && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setInvoiceSale(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="w-10 h-1 rounded-full bg-[#D9CCAF]" /></div>
            <div className="flex items-center justify-between px-5 py-3 shrink-0">
              <p className="text-sm font-semibold text-[#2C1810]">Invoice</p>
              <div className="flex items-center gap-2">
                <button onClick={() => printInvoice(invoiceSale, false)} className="flex items-center gap-1.5 text-xs font-medium text-[#7C6352] bg-[#FBF8F2] border border-[#D9CCAF] rounded-lg px-3 py-1.5">
                  <Printer size={13} /> Struk
                </button>
                <button onClick={() => printInvoice(invoiceSale, true)} className="flex items-center gap-1.5 text-xs font-medium text-[#7C6352] bg-[#FBF8F2] border border-[#D9CCAF] rounded-lg px-3 py-1.5">
                  <Printer size={13} /> Kasir
                </button>
                <button onClick={handleShareInvoice} disabled={sharing} className="flex items-center gap-1.5 text-xs font-medium text-[#7C6352] bg-[#FBF8F2] border border-[#D9CCAF] rounded-lg px-3 py-1.5 disabled:opacity-50">
                  {sharing ? "..." : <><Share2 size={13} /> Kirim</>}
                </button>
                <button onClick={() => setInvoiceSale(null)} className="p-1.5 text-[#B88D6A] hover:text-[#7C6352] rounded-lg"><X size={16} /></button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              <div ref={invoiceRef} style={{ padding: "16px 16px 24px", backgroundColor: "#fdf6ee" }}>
                <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #D9CCAF" }}>
                  <div style={{ backgroundColor: "#FBF8F2", padding: "16px 20px", textAlign: "center" }}>
                    <p style={{ fontSize: 20, fontWeight: 700, color: "#2C1810", marginBottom: 2 }}>{storeName}</p>
                    <p style={{ fontSize: 10, color: "#B88D6A", marginBottom: 4 }}>Tata Data Dapur</p>
                    <p style={{ fontSize: 11, color: "#7C6352" }}>{format(new Date(invoiceSale.created_at), "dd MMM yyyy")}</p>
                    {(invoiceSale as any).category?.name && <p style={{ fontSize: 10, color: "#B88D6A", marginTop: 2 }}>{(invoiceSale as any).category.name}</p>}
                    <p style={{ fontSize: 9, color: "#B88D6A", fontFamily: "monospace", marginTop: 4 }}>#{invoiceSale.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <div style={{ backgroundColor: "#fff", padding: "16px 20px" }}>
                    <div style={{ paddingBottom: 10, borderBottom: "1px solid #F5EFE0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <span style={{ fontSize: 14, color: "#2C1810", fontWeight: 600 }}>{invoiceSale.quantity_sold}× {(invoiceSale.recipe as any)?.name ?? "—"}</span>
                        <span style={{ fontSize: 14, color: "#2C1810", fontWeight: 600, whiteSpace: "nowrap" }}>{formatCurrency(invoiceSale.selling_price * invoiceSale.quantity_sold)}</span>
                      </div>
                      {(invoiceSale.sale_addons ?? []).map((a) => (
                        <div key={a.id} style={{ display: "flex", justifyContent: "space-between", marginTop: 4, paddingLeft: 16 }}>
                          <span style={{ fontSize: 11, color: "#7C6352" }}>+ {a.name_at_sale} ({a.quantity}×)<br /><span style={{ fontSize: 10, color: "#B88D6A" }}>@ {formatCurrency(a.price_per_unit_at_sale)}</span></span>
                          <span style={{ fontSize: 11, color: "#7C6352", whiteSpace: "nowrap" }}>{formatCurrency(a.quantity * a.price_per_unit_at_sale)}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ borderTop: "2px dashed #D9CCAF", marginTop: 12, marginBottom: 12 }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#7C6352" }}>Total</span>
                      <span style={{ fontSize: 22, fontWeight: 700, color: "#2C1810" }}>{formatCurrency(invoiceSale.selling_price * invoiceSale.quantity_sold)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
