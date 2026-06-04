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
import { Sale, SaleItem } from "@/types";
import { formatCurrency, formatThousands } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import {
  AlertTriangle, CheckCircle2, FileText, Filter, Minus, Pencil, Plus,
  Printer, Search, Share2, TrendingUp, Trash2, X,
} from "lucide-react";
import { useMemo, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

const cls =
  "h-9 rounded-lg border border-[#D9CCAF] bg-[#FBF8F2] px-3 text-sm text-[#2C1810] placeholder:text-[#B88D6A] focus:outline-none focus:ring-2 focus:ring-[#A05035] focus:border-transparent";

// ─── Local types ──────────────────────────────────────────────────────────────

interface AddonRow {
  sourceKey: string;
  quantity: string;
  name: string;
  pricePerUnit: number;
}

interface ItemRow {
  _key: string;
  recipeId: string;
  quantity: string;
  sellingPrice: string;
  baseSellingPrice: string; // recipe's standalone price, used for auto-sum with addons
  addonRows: AddonRow[];
}

interface ReceiptItem {
  recipeName: string;
  quantity: number;
  sellingPrice: number;
  addons: Array<{ name: string; qty: number }>;
}

interface ReceiptSnapshot {
  id: string;
  date: string;
  categoryName: string;
  items: ReceiptItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function saleRevenue(s: Sale) {
  return (s.sale_items ?? []).reduce(
    (sum, si) => sum + si.selling_price * si.quantity_sold,
    0,
  );
}
function saleHPP(s: Sale) {
  return (s.sale_items ?? []).reduce(
    (sum, si) =>
      sum + si.hpp_at_sale * si.quantity_sold + (si.hpp_addons_at_sale ?? 0),
    0,
  );
}
function saleProfit(s: Sale) {
  return saleRevenue(s) - saleHPP(s);
}
function saleMargin(s: Sale) {
  const rev = saleRevenue(s);
  return rev > 0 ? (saleProfit(s) / rev) * 100 : 0;
}

function emptyItemRow(): ItemRow {
  return { _key: crypto.randomUUID(), recipeId: "", quantity: "1", sellingPrice: "", baseSellingPrice: "", addonRows: [] };
}

function calcSellingPrice(baseSellingPrice: string, addonRows: AddonRow[]): string {
  if (!baseSellingPrice) return "";
  const base = Number(baseSellingPrice);
  const addonSum = addonRows.reduce((s, a) => s + (a.pricePerUnit || 0), 0);
  return String(base + addonSum);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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
  const qc = useQueryClient();

  // ─── Stock confirm state ───────────────────────────────────────────────────
  interface StockShortfall {
    recipeId: string;
    recipeName: string;
    currentStock: number;
    needed: number;
  }
  type SalePayloadItem = {
    recipe_id: string;
    quantity_sold: number;
    selling_price: number;
    hpp_at_sale: number;
    addons?: Array<{
      item_id?: string | null;
      sub_recipe_id?: string | null;
      quantity: number;
      price_per_unit_at_sale: number;
      hpp_per_unit?: number;
      name_at_sale: string;
    }>;
  };
  const [stockConfirm, setStockConfirm] = useState<{
    shortfalls: StockShortfall[];
    payload: SalePayloadItem[];
  } | null>(null);
  const [producePending, setProducePending] = useState(false);

  // ─── Modal state ───────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [itemRows, setItemRows] = useState<ItemRow[]>([emptyItemRow()]);
  const [expandedItemKey, setExpandedItemKey] = useState<string>("");

  // ─── Invoice / Receipt state ───────────────────────────────────────────────
  const [receipt, setReceipt] = useState<ReceiptSnapshot | null>(null);
  const [invoiceSale, setInvoiceSale] = useState<Sale | null>(null);
  const [sharing, setSharing] = useState(false);
  const [storeName, setStoreName] = useState("Toko Anda");
  const receiptRef = useRef<HTMLDivElement>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (user?.user_metadata?.store_name)
          setStoreName(user.user_metadata.store_name);
      });
  }, []);

  // ─── List / filter state ───────────────────────────────────────────────────
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterRecipe, setFilterRecipe] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [pendingSortBy, setPendingSortBy] = useState("date_desc");
  const [pendingFilterRecipe, setPendingFilterRecipe] = useState("");
  const [pendingFilterCategory, setPendingFilterCategory] = useState("");

  // ─── Item row helpers ──────────────────────────────────────────────────────

  function addItemRow() {
    const row = emptyItemRow();
    setItemRows((r) => [...r, row]);
    setExpandedItemKey(row._key);
  }

  function removeItemRow(key: string) {
    setItemRows((r) => {
      const next = r.filter((x) => x._key !== key);
      return next.length ? next : [emptyItemRow()];
    });
  }

  function updateItemField(key: string, field: "recipeId" | "quantity" | "sellingPrice", value: string) {
    setItemRows((rows) =>
      rows.map((r) => (r._key !== key ? r : { ...r, [field]: value })),
    );
  }

  function selectRecipe(key: string, recipeId: string) {
    const recipe = recipes?.find((r) => r.id === recipeId);
    const basePrice = recipe?.selling_price ? String(recipe.selling_price) : "";
    setItemRows((rows) =>
      rows.map((r) => {
        if (r._key !== key) return r;
        const nextRow = { ...r, recipeId, baseSellingPrice: basePrice };
        return { ...nextRow, sellingPrice: calcSellingPrice(basePrice, r.addonRows) || basePrice };
      }),
    );
  }

  function addAddonToItem(key: string) {
    setItemRows((rows) =>
      rows.map((r) =>
        r._key !== key
          ? r
          : {
              ...r,
              addonRows: [
                ...r.addonRows,
                { sourceKey: "", quantity: "1", name: "", pricePerUnit: 0 },
              ],
            },
      ),
    );
  }

  function removeAddonFromItem(itemKey: string, addonIdx: number) {
    setItemRows((rows) =>
      rows.map((r) => {
        if (r._key !== itemKey) return r;
        const updatedAddons = r.addonRows.filter((_, i) => i !== addonIdx);
        const newPrice = calcSellingPrice(r.baseSellingPrice, updatedAddons);
        return { ...r, addonRows: updatedAddons, ...(newPrice && { sellingPrice: newPrice }) };
      }),
    );
  }

  function updateAddonPrice(itemKey: string, addonIdx: number, price: number) {
    setItemRows((rows) =>
      rows.map((r) => {
        if (r._key !== itemKey) return r;
        const updatedAddons = r.addonRows.map((a, i) =>
          i !== addonIdx ? a : { ...a, pricePerUnit: price },
        );
        const newPrice = calcSellingPrice(r.baseSellingPrice, updatedAddons);
        return { ...r, addonRows: updatedAddons, ...(newPrice && { sellingPrice: newPrice }) };
      }),
    );
  }

  function selectAddonSource(itemKey: string, addonIdx: number, sourceKey: string) {
    const [type, id] = sourceKey.split(":");
    let name = "";
    let pricePerUnit = 0;
    if (type === "item") {
      const item = addonItems?.find((x) => x.id === id);
      name = item?.name ?? "";
      pricePerUnit = item?.selling_price || item?.avg_price || 0;
    } else if (type === "sr") {
      const sr =
        addonSubRecipes?.find((x) => x.id === id) ??
        addonFinishedRecipes?.find((x) => x.id === id);
      name = sr?.name ?? "";
      pricePerUnit = sr?.selling_price || sr?.avg_price || 0;
    }
    setItemRows((rows) =>
      rows.map((r) => {
        if (r._key !== itemKey) return r;
        const updatedAddons = r.addonRows.map((a, i) =>
          i !== addonIdx ? a : { ...a, sourceKey, name, pricePerUnit },
        );
        const newPrice = calcSellingPrice(r.baseSellingPrice, updatedAddons);
        return { ...r, addonRows: updatedAddons, ...(newPrice && { sellingPrice: newPrice }) };
      }),
    );
  }

  function updateAddonQty(itemKey: string, addonIdx: number, qty: string) {
    setItemRows((rows) =>
      rows.map((r) =>
        r._key !== itemKey
          ? r
          : {
              ...r,
              addonRows: r.addonRows.map((a, i) =>
                i !== addonIdx ? a : { ...a, quantity: qty },
              ),
            },
      ),
    );
  }

  // ─── Category helpers ──────────────────────────────────────────────────────

  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    const cat = await createCategory.mutateAsync(newCatName.trim());
    setCategoryId(cat.id);
    setNewCatName("");
    setAddingCat(false);
  }

  // ─── Modal open/close ──────────────────────────────────────────────────────

  function resetForm() {
    setEditing(null);
    setDate(new Date().toISOString().slice(0, 10));
    setCategoryId("");
    setNewCatName("");
    setAddingCat(false);
    const row = emptyItemRow();
    setItemRows([row]);
    setExpandedItemKey(row._key);
  }

  function openCreate() {
    resetForm();
    setModalOpen(true);
  }

  function openEdit(s: Sale) {
    setEditing(s);
    setDate(new Date(s.created_at).toISOString().slice(0, 10));
    setCategoryId(s.category_id ?? "");
    setNewCatName("");
    setAddingCat(false);
    const rows = (s.sale_items ?? []).map((si) => ({
      _key: si.id,
      recipeId: si.recipe_id,
      quantity: String(si.quantity_sold),
      sellingPrice: String(si.selling_price),
      baseSellingPrice: "",
      addonRows: (si.sale_addons ?? []).map((a) => ({
        sourceKey: a.item_id ? `item:${a.item_id}` : `sr:${a.sub_recipe_id}`,
        quantity: String(a.quantity),
        name: a.name_at_sale,
        pricePerUnit: a.price_per_unit_at_sale,
      })),
    }));
    setItemRows(rows.length ? rows : [emptyItemRow()]);
    setExpandedItemKey("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  // ─── Submit ────────────────────────────────────────────────────────────────

  async function executeSale(itemsPayload: SalePayloadItem[]) {
    if (editing) {
      await updateSale.mutateAsync({
        id: editing.id,
        category_id: categoryId || null,
        date,
        items: itemsPayload,
      });
    } else {
      const saleId = await createSale.mutateAsync({
        category_id: categoryId || null,
        date,
        items: itemsPayload,
      });
      if (saleId) {
        setReceipt({
          id: saleId,
          date,
          categoryName: categories?.find((c) => c.id === categoryId)?.name ?? "",
          items: itemsPayload.map((item) => ({
            recipeName: recipes?.find((r) => r.id === item.recipe_id)?.name ?? "—",
            quantity: item.quantity_sold,
            sellingPrice: item.selling_price,
            addons: (item.addons ?? []).map((a) => ({
              name: a.name_at_sale,
              qty: a.quantity,
            })),
          })),
        });
      }
    }
    closeModal();
    resetForm();
  }

  async function handleProduceAndSell() {
    if (!stockConfirm) return;
    setProducePending(true);
    let produced = 0;
    const total = stockConfirm.shortfalls.length;
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      for (const sf of stockConfirm.shortfalls) {
        const recipe = recipes?.find((r) => r.id === sf.recipeId);
        const shortfall = sf.needed - sf.currentStock;
        const hppTotal = (recipe?.hpp ?? 0) * shortfall;
        const { error } = await supabase.rpc("produce_recipe", {
          p_user_id: user!.id,
          p_recipe_id: sf.recipeId,
          p_batches: shortfall,
          p_total_cost: hppTotal,
        });
        if (error) throw error;
        produced++;
      }
      const payload = stockConfirm.payload;
      setStockConfirm(null);
      await executeSale(payload);
    } catch (e: unknown) {
      const msg = produced > 0 && produced < total
        ? `Produksi sebagian berhasil (${produced}/${total} resep). Penjualan dibatalkan. Cek halaman Produksi untuk koreksi manual.`
        : ((e as Error).message ?? "Gagal produksi");
      toast.error(msg, { duration: 6000 });
    } finally {
      setProducePending(false);
      qc.invalidateQueries({ queryKey: ["productions"] });
      qc.invalidateQueries({ queryKey: ["recipes"] });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validRows = itemRows.filter(
      (r) => r.recipeId && Number(r.quantity) > 0 && r.sellingPrice,
    );
    if (!validRows.length) return;

    const itemsPayload: SalePayloadItem[] = validRows.map((row) => {
      const recipe = recipes?.find((r) => r.id === row.recipeId);
      const validAddons = row.addonRows
        .filter((a) => a.sourceKey && Number(a.quantity) > 0)
        .map((a) => {
          const [type, id] = a.sourceKey.split(":");
          let hppPerUnit = 0;
          if (type === "item") {
            hppPerUnit = addonItems?.find((x) => x.id === id)?.avg_price ?? 0;
          } else if (type === "sr") {
            hppPerUnit =
              addonSubRecipes?.find((x) => x.id === id)?.avg_price ??
              addonFinishedRecipes?.find((x) => x.id === id)?.avg_price ??
              0;
          }
          return {
            item_id: type === "item" ? id : null,
            sub_recipe_id: type === "sr" ? id : null,
            quantity: Number(a.quantity),
            price_per_unit_at_sale: a.pricePerUnit,
            hpp_per_unit: hppPerUnit,
            name_at_sale: a.name,
          };
        });
      return {
        recipe_id: row.recipeId,
        quantity_sold: Number(row.quantity),
        selling_price: Number(row.sellingPrice),
        hpp_at_sale: recipe?.hpp ?? 0,
        addons: validAddons,
      };
    });

    // Check stock for each recipe before submitting
    const shortfalls = validRows
      .map((row) => {
        const recipe = recipes?.find((r) => r.id === row.recipeId);
        if (!recipe) return null;
        const currentStock = recipe.stock ?? 0;
        const needed = Number(row.quantity);
        if (currentStock >= needed) return null;
        return { recipeId: row.recipeId, recipeName: recipe.name, currentStock, needed };
      })
      .filter(Boolean) as StockShortfall[];

    if (shortfalls.length > 0) {
      setStockConfirm({ shortfalls, payload: itemsPayload });
      return;
    }

    await executeSale(itemsPayload);
  }

  // ─── Filter & sort ─────────────────────────────────────────────────────────

  const negativeStockRecipes = useMemo(
    () => (recipes ?? []).filter((r) => !r.is_ingredient && !r.is_addon && (r.stock ?? 0) < 0),
    [recipes],
  );

  const filtered = useMemo(() => {
    let rows = sales ?? [];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((s) =>
        (s.sale_items ?? []).some((si) =>
          ((si.recipe as any)?.name ?? "").toLowerCase().includes(q),
        ),
      );
    }
    if (filterRecipe) {
      rows = rows.filter((s) =>
        (s.sale_items ?? []).some((si) => si.recipe_id === filterRecipe),
      );
    }
    if (filterCategory) {
      rows = rows.filter((s) => s.category_id === filterCategory);
    }
    return [...rows].sort((a, b) => {
      switch (sortBy) {
        case "date_asc":
          return (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        case "profit_desc":
          return saleProfit(b) - saleProfit(a);
        case "profit_asc":
          return saleProfit(a) - saleProfit(b);
        case "revenue_desc":
          return saleRevenue(b) - saleRevenue(a);
        default:
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
      }
    });
  }, [sales, search, filterRecipe, filterCategory, sortBy]);

  const hasFilters =
    search || filterRecipe || filterCategory || sortBy !== "date_desc";

  // ─── Print / Share helpers ─────────────────────────────────────────────────

  function openPrintWindow(html: string) {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  }

  function buildItemRowsHtml(items: ReceiptItem[]) {
    return items
      .map(
        (item) =>
          `<tr><td style="font-size:11pt;color:#2C1810;padding:7px 0 2px">
            <strong>${item.quantity}×</strong> ${item.recipeName}
          </td><td style="text-align:right;font-size:11pt;color:#2C1810;white-space:nowrap;vertical-align:top;padding:7px 0 2px">
            ${formatCurrency(item.sellingPrice * item.quantity)}
          </td></tr>` +
          item.addons
            .map(
              (a) =>
                `<tr><td style="font-size:10pt;color:#7C6352;padding:0 0 6px 16px">+ ${a.name} (${a.qty}×)</td><td></td></tr>`,
            )
            .join(""),
      )
      .join("");
  }

  function buildItemRowsThermal(items: ReceiptItem[]) {
    return items
      .map(
        (item) =>
          `<tr><td style="font-size:8.5pt;padding:1.5mm 0 0.5mm"><strong>${item.quantity}×</strong> ${item.recipeName}</td>
          <td style="text-align:right;font-size:8.5pt;white-space:nowrap;vertical-align:top;padding:1.5mm 0 0.5mm">${formatCurrency(item.sellingPrice * item.quantity)}</td></tr>` +
          item.addons
            .map(
              (a) =>
                `<tr><td style="font-size:7.5pt;color:#555;padding:0 0 1.5mm 4mm" colspan="2">+ ${a.name} (${a.qty}×)</td></tr>`,
            )
            .join(""),
      )
      .join("");
  }

  function buildStrokHtml(opts: {
    date: string;
    txId?: string;
    categoryName?: string;
    items: ReceiptItem[];
    total: number;
  }) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Struk - ${storeName}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#fdf6ee;min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:24px}.card{background:#fff;border-radius:16px;max-width:420px;width:100%;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.15)}.hdr{background:#FBF8F2;padding:20px 20px 16px;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}.store-name{font-size:20pt;font-weight:700;color:#2C1810;margin-bottom:3px}.brand{font-size:9pt;color:#B88D6A;margin-bottom:4px}.sub{font-size:9pt;color:#7C6352;margin-bottom:2px}.txid{font-size:7pt;color:#B88D6A;font-family:monospace;margin-top:4px}.body{padding:20px}table{width:100%;border-collapse:collapse;margin-bottom:4px}tr{border-bottom:1px solid #F5EFE0}tr:last-child{border-bottom:none}td{padding:7px 0;font-size:10pt;vertical-align:top;color:#2C1810}.div{border:none;border-top:2px dashed #D9CCAF;margin:12px 0}.total{display:flex;justify-content:space-between;align-items:center}.total-label{font-size:12pt;font-weight:700;color:#7C6352}.total-amt{font-size:20pt;font-weight:700;color:#2C1810;font-variant-numeric:tabular-nums}@media print{body{background:#fff;padding:0}.card{box-shadow:none;border-radius:0}.hdr{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
<div class="card"><div class="hdr">
<img src="/td-logo.png" alt="Logo" style="width:52px;height:52px;border-radius:12px;object-fit:contain;background:#A05035;padding:4px;margin-bottom:8px">
<p class="store-name">${storeName}</p>
<p class="brand">Tata Data Dapur</p>
<p class="sub">${opts.date}</p>
${opts.categoryName ? `<p class="sub">${opts.categoryName}</p>` : ""}
${opts.txId ? `<p class="txid">#${opts.txId}</p>` : ""}
</div><div class="body">
<table>${buildItemRowsHtml(opts.items)}</table>
<hr class="div"><div class="total"><span class="total-label">Total</span><span class="total-amt">${formatCurrency(opts.total)}</span></div>
</div></div><script>window.onload=function(){window.print()}<\/script></body></html>`;
  }

  function buildThermalHtml(opts: {
    date: string;
    txId?: string;
    categoryName?: string;
    items: ReceiptItem[];
    total: number;
  }) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Kasir - ${storeName}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}@page{size:58mm auto;margin:4mm 3mm}body{font-family:"Courier New",Courier,monospace;font-size:9pt;color:#000;width:52mm}h1{font-size:11pt;font-weight:700;text-align:center;margin-bottom:0.5mm}h2{font-size:8pt;font-weight:400;text-align:center;margin-bottom:1mm;opacity:.7}.sub{font-size:8pt;text-align:center;margin-bottom:0.5mm}.txid{font-size:7pt;text-align:center;margin-bottom:3mm;opacity:.7}.div-solid{border-top:1px solid #000;margin:2mm 0}.div-dash{border-top:1px dashed #000;margin:2mm 0}table{width:100%;border-collapse:collapse}td{font-size:8.5pt;padding:1.5mm 0;vertical-align:top}.total-row{display:flex;justify-content:space-between;align-items:baseline;margin-top:1mm}.total-label{font-size:9pt;font-weight:700}.total-amt{font-size:13pt;font-weight:700}.footer{text-align:center;font-size:7pt;margin-top:4mm;opacity:.6}@media print{body{width:auto}}</style></head><body>
<div style="text-align:center;margin-bottom:2mm"><img src="/td-logo.png" alt="Logo" style="width:36px;height:36px;border-radius:8px;object-fit:contain;background:#A05035;padding:3px"></div>
<h1>${storeName}</h1><h2>Tata Data Dapur</h2>
<p class="sub">${opts.date}</p>
${opts.categoryName ? `<p class="sub">${opts.categoryName}</p>` : ""}
${opts.txId ? `<p class="txid">#${opts.txId}</p>` : ""}
<div class="div-solid"></div>
<table>${buildItemRowsThermal(opts.items)}</table>
<div class="div-dash"></div>
<div class="total-row"><span class="total-label">TOTAL</span><span class="total-amt">${formatCurrency(opts.total)}</span></div>
<div class="div-solid"></div><p class="footer">Terima kasih</p>
<script>window.onload=function(){window.print()}<\/script></body></html>`;
  }

  function printFromReceipt(r: ReceiptSnapshot, thermal: boolean) {
    const total = r.items.reduce((s, i) => s + i.sellingPrice * i.quantity, 0);
    const opts = {
      date: format(new Date(r.date), "dd MMM yyyy"),
      txId: r.id.slice(0, 8).toUpperCase(),
      categoryName: r.categoryName || undefined,
      items: r.items,
      total,
    };
    openPrintWindow(thermal ? buildThermalHtml(opts) : buildStrokHtml(opts));
  }

  function printFromSale(s: Sale, thermal: boolean) {
    const items: ReceiptItem[] = (s.sale_items ?? []).map((si) => ({
      recipeName: (si.recipe as any)?.name ?? "—",
      quantity: si.quantity_sold,
      sellingPrice: si.selling_price,
      addons: (si.sale_addons ?? []).map((a) => ({
        name: a.name_at_sale,
        qty: a.quantity,
      })),
    }));
    const total = items.reduce((s, i) => s + i.sellingPrice * i.quantity, 0);
    const opts = {
      date: format(new Date(s.created_at), "dd MMM yyyy"),
      txId: s.id.slice(0, 8).toUpperCase(),
      categoryName: (s as any).category?.name || undefined,
      items,
      total,
    };
    openPrintWindow(thermal ? buildThermalHtml(opts) : buildStrokHtml(opts));
  }

  async function captureAndShare(
    ref: React.RefObject<HTMLDivElement | null>,
    filename: string,
    title: string,
    fallback: () => void,
  ) {
    if (!ref.current) { fallback(); return; }
    try {
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(ref.current, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      if (!blob) throw new Error("toBlob returned null");
      const pngFilename = filename.replace(/\.(jpg|jpeg)$/i, ".png");
      const file = new File([blob], pngFilename, { type: "image/png" });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = pngFilename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error("captureAndShare failed:", e);
      toast.error("Gagal membuat gambar");
      fallback();
    }
  }

  async function handleShareReceipt() {
    if (!receipt) return;
    setSharing(true);
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r as FrameRequestCallback)),
    );
    await captureAndShare(
      receiptRef,
      `struk-${receipt.id.slice(0, 8)}.png`,
      "Struk Transaksi",
      () => printFromReceipt(receipt, false),
    );
    setSharing(false);
  }

  async function handleShareInvoice() {
    if (!invoiceSale) return;
    setSharing(true);
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r as FrameRequestCallback)),
    );
    await captureAndShare(
      invoiceRef,
      `invoice-${invoiceSale.id.slice(0, 8)}.png`,
      "Invoice Transaksi",
      () => printFromSale(invoiceSale, false),
    );
    setSharing(false);
  }

  // ─── JSX ──────────────────────────────────────────────────────────────────

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
      {/* ── Negative stock banner ──────────────────────────────────────────────── */}
      {negativeStockRecipes.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <span className="font-semibold">Stok produk jadi negatif: </span>
            {negativeStockRecipes.map((r, i) => (
              <span key={r.id}>
                {r.name} ({r.stock ?? 0} pcs){i < negativeStockRecipes.length - 1 ? ", " : ""}
              </span>
            ))}
            <span className="ml-1">— buat produksi untuk mengisi stok.</span>
          </div>
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
                <button
                  onClick={() => setFilterSheetOpen(false)}
                  className="text-[#B88D6A] hover:text-[#7C6352]"
                >
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
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
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
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
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
                filterRecipe || filterCategory || sortBy !== "date_desc"
                  ? "border-[#A05035] bg-[#A05035]/10 text-[#A05035]"
                  : "border-[#D9CCAF] bg-[#FBF8F2] text-[#7C6352] hover:bg-[#EDE4CF]"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filter
              {(filterRecipe || filterCategory || sortBy !== "date_desc") && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#A05035] text-white text-[10px] flex items-center justify-center font-bold">
                  {
                    [filterRecipe, filterCategory, sortBy !== "date_desc"].filter(Boolean).length
                  }
                </span>
              )}
            </button>
          </div>
          <div className="flex items-center justify-between text-xs text-[#B88D6A]">
            <span>
              {filtered.length} transaksi
              {(sales?.length ?? 0) > filtered.length && ` dari ${sales?.length}`}
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
            <div className="py-12 text-center text-sm text-[#B88D6A]">Memuat...</div>
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
            <div className="divide-y divide-[#EDE4CF]">
              {filtered.map((s) => {
                const rev = saleRevenue(s);
                const hpp = saleHPP(s);
                const profit = rev - hpp;
                const margin = rev > 0 ? (profit / rev) * 100 : 0;
                const isExpanded = expandedSaleId === s.id;

                return (
                  <div
                    key={s.id}
                    className="px-4 py-3 hover:bg-[#F5EFE0] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {/* Items list */}
                        <div className="space-y-0.5">
                          {(s.sale_items ?? []).map((si) => (
                            <div key={si.id}>
                              <p className="text-sm font-medium text-[#2C1810] truncate">
                                {si.quantity_sold}× {(si.recipe as any)?.name ?? "—"}
                              </p>
                              {(si.sale_addons ?? []).length > 0 && (
                                <div className="flex flex-wrap gap-x-2 pl-4">
                                  {(si.sale_addons ?? []).map((a) => (
                                    <span
                                      key={a.id}
                                      className="text-[10px] text-[#B88D6A]"
                                    >
                                      + {a.name_at_sale} ({a.quantity}×)
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {/* Meta */}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {(s as any).category ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#EDE4CF] text-[#5C4535]">
                              {(s as any).category.name}
                            </span>
                          ) : null}
                          <span className="text-[10px] text-[#B88D6A]">
                            {format(new Date(s.created_at), "dd MMM yyyy")}
                          </span>
                        </div>
                      </div>
                      {/* Actions & profit */}
                      <div className="flex items-center gap-1 shrink-0">
                        <div className="text-right mr-1">
                          <p
                            className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
                              profit >= 0 ? "text-[#737B4C]" : "text-red-600"
                            }`}
                          >
                            {formatCurrency(profit)}
                          </p>
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded tabular-nums ${
                              margin >= 30
                                ? "text-[#5C6B38]"
                                : margin >= 15
                                ? "text-[#7C563D]"
                                : "text-red-600"
                            }`}
                          >
                            {margin.toFixed(1)}%
                          </span>
                        </div>
                        <button
                          onClick={() => setInvoiceSale(s)}
                          className="p-1.5 rounded-lg text-[#B88D6A] hover:text-[#A05035] hover:bg-[#EDE4CF] transition-colors"
                          aria-label="Invoice"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEdit(s)}
                          className="p-1.5 rounded-lg text-[#B88D6A] hover:text-[#A05035] hover:bg-[#EDE4CF] transition-colors"
                          aria-label="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Hapus penjualan ini?"))
                              deleteSale.mutate(s.id);
                          }}
                          className="p-1.5 rounded-lg text-[#B88D6A] hover:text-red-500 hover:bg-red-50 transition-colors"
                          aria-label="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {/* Revenue + HPP summary */}
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-[#B88D6A] tabular-nums flex-wrap">
                      <span>Pendapatan {formatCurrency(rev)}</span>
                      <span>·</span>
                      <button
                        onClick={() =>
                          setExpandedSaleId(isExpanded ? null : s.id)
                        }
                        className={`${hpp > 0 ? "text-[#A05035] font-medium" : ""} hover:underline`}
                      >
                        HPP {formatCurrency(hpp)}
                        {hpp > 0 && " ▾"}
                      </button>
                    </div>
                    {/* HPP breakdown */}
                    {isExpanded && (
                      <div className="mt-2 rounded-lg bg-[#F5EFE0] border border-[#E5DACA] px-3 py-2 text-[10px] space-y-1">
                        {(s.sale_items ?? []).map((si) => (
                          <div key={si.id}>
                            <div className="flex justify-between text-[#7C6352]">
                              <span>
                                HPP {(si.recipe as any)?.name ?? "—"} ({si.quantity_sold}×)
                              </span>
                              <span className="tabular-nums">
                                {formatCurrency(si.hpp_at_sale * si.quantity_sold)}
                              </span>
                            </div>
                            {(si.sale_addons ?? []).map((a) => (
                              <div
                                key={a.id}
                                className="flex justify-between text-[#B88D6A] pl-3"
                              >
                                <span>
                                  + {a.name_at_sale} ({a.quantity}×)
                                </span>
                                <span className="tabular-nums">
                                  {formatCurrency(a.quantity * a.price_per_unit_at_sale)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ))}
                        <div className="flex justify-between font-semibold text-[#2C1810] border-t border-[#D9CCAF] pt-1">
                          <span>HPP Akhir</span>
                          <span className="tabular-nums">{formatCurrency(hpp)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── Form Modal ─────────────────────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? "Edit Penjualan" : "Catat Penjualan"}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[#4A3728]">
                Item Pesanan
              </span>
              <button
                type="button"
                onClick={addItemRow}
                className="text-xs text-[#A05035] hover:underline font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Tambah Item
              </button>
            </div>

            {itemRows.map((row, rowIdx) => {
              const recipe = recipes?.find((r) => r.id === row.recipeId);
              const hpp = recipe?.hpp ?? 0;
              const addonTotal = row.addonRows.reduce(
                (s, a) =>
                  a.sourceKey && Number(a.quantity) > 0
                    ? s + a.pricePerUnit * Number(a.quantity)
                    : s,
                0,
              );
              const hppPerUnit =
                hpp + (Number(row.quantity) > 0 ? addonTotal / Number(row.quantity) : 0);
              const isOpen = expandedItemKey === row._key;

              return (
                <div
                  key={row._key}
                  className="rounded-xl border border-[#D9CCAF] bg-[#FBF8F2] overflow-hidden"
                >
                  {/* Header row (collapsed / expanded toggle) */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedItemKey(isOpen ? "" : row._key)
                    }
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-[#B88D6A] shrink-0">
                        Item {rowIdx + 1}
                      </span>
                      {row.recipeId && recipe ? (
                        <span className="text-sm font-medium text-[#2C1810] truncate">
                          {row.quantity}× {recipe.name}
                          {row.sellingPrice && (
                            <span className="text-[#B88D6A] font-normal">
                              {" "}— {formatCurrency(Number(row.sellingPrice) * Number(row.quantity))}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-sm text-[#D9CCAF]">Belum diisi</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {itemRows.length > 1 && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            removeItemRow(row._key);
                          }}
                          className="p-1.5 text-red-400 hover:text-red-600 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <Plus
                        className={`w-3.5 h-3.5 text-[#B88D6A] transition-transform ${isOpen ? "rotate-45" : ""}`}
                      />
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isOpen && (
                    <div className="px-3 pb-3 space-y-3 border-t border-[#E5DACA]">
                      <div className="pt-2">
                        <Select
                          label="Produk"
                          value={row.recipeId}
                          onChange={(e) =>
                            selectRecipe(row._key, e.target.value)
                          }
                          required
                        >
                          <option value="">Pilih produk...</option>
                          {recipes?.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name} — HPP {formatCurrency(r.hpp)}
                            </option>
                          ))}
                        </Select>
                      </div>

                      {/* Add-ons */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-[#7C6352]">Add-On</span>
                          <button
                            type="button"
                            onClick={() => addAddonToItem(row._key)}
                            className="text-xs text-[#A05035] hover:underline font-medium flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Tambah
                          </button>
                        </div>
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
                            {/* Row 2: qty + price + clear (shown when source selected) */}
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
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="Harga jual"
                                  value={addon.pricePerUnit ? formatThousands(String(addon.pricePerUnit)) : ""}
                                  onChange={(e) =>
                                    updateAddonPrice(row._key, addonIdx, Number(e.target.value.replace(/\./g, "")))
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
                        {addonTotal > 0 && (
                          <p className="text-xs text-[#B88D6A] text-right">
                            Total add-on:{" "}
                            <span className="font-semibold tabular-nums">
                              {formatCurrency(addonTotal)}
                            </span>
                          </p>
                        )}
                      </div>

                      <Input
                        label="Jumlah Terjual"
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(e) =>
                          updateItemField(row._key, "quantity", e.target.value)
                        }
                        required
                      />

                      <div>
                        <Input
                          label="Harga Jual per Unit (Rp)"
                          type="text"
                          inputMode="numeric"
                          value={formatThousands(row.sellingPrice)}
                          onChange={(e) =>
                            updateItemField(row._key, "sellingPrice", e.target.value.replace(/\./g, ""))
                          }
                          required
                          placeholder={
                            hppPerUnit > 0 ? formatThousands(String(Math.ceil(hppPerUnit))) : undefined
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Kategori */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-[#4A3728]">Kategori</label>
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

          {/* Tanggal */}
          <div>
            <label className="block text-sm font-medium text-[#4A3728] mb-1">
              Tanggal Transaksi
            </label>
            <input
              type="date"
              className={`${cls} w-full`}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              required
            />
          </div>

          {/* Total preview */}
          {itemRows.some((r) => r.recipeId && r.sellingPrice) && (
            <div className="rounded-lg px-4 py-3 bg-[#F5EFE0] border border-[#E5DACA] text-xs space-y-1">
              {itemRows
                .filter((r) => r.recipeId && r.sellingPrice)
                .map((r) => {
                  const rec = recipes?.find((x) => x.id === r.recipeId);
                  const rev = Number(r.sellingPrice) * Number(r.quantity);
                  const hppProd = (rec?.hpp ?? 0) * Number(r.quantity);
                  const addonTotal = r.addonRows.reduce(
                    (s, a) =>
                      a.sourceKey && Number(a.quantity) > 0
                        ? s + a.pricePerUnit * Number(a.quantity)
                        : s,
                    0,
                  );
                  const profit = rev - hppProd - addonTotal;
                  return (
                    <div key={r._key} className="flex justify-between text-[#5C4535]">
                      <span className="truncate max-w-[60%]">{rec?.name ?? "Item"}</span>
                      <span
                        className={`tabular-nums font-medium ${profit >= 0 ? "text-[#737B4C]" : "text-red-600"}`}
                      >
                        Laba {formatCurrency(profit)}
                      </span>
                    </div>
                  );
                })}
              <div className="flex justify-between font-bold border-t border-[#D9CCAF] pt-1 text-[#2C1810]">
                <span>Total Pendapatan</span>
                <span className="tabular-nums">
                  {formatCurrency(
                    itemRows.reduce(
                      (s, r) => s + Number(r.sellingPrice || 0) * Number(r.quantity || 0),
                      0,
                    ),
                  )}
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

      {/* ── Stock Confirm Modal ──────────────────────────────────────────────────── */}
      {stockConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setStockConfirm(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-[#FBF8F2] p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span className="font-semibold text-[#2C1810]">Stok tidak cukup</span>
            </div>
            <div className="mb-5 space-y-2">
              {stockConfirm.shortfalls.map((sf) => (
                <div key={sf.recipeId} className="rounded-lg border border-[#D9CCAF] bg-white px-3 py-2.5 text-sm">
                  <p className="font-medium text-[#2C1810]">{sf.recipeName}</p>
                  <p className="mt-0.5 text-[#7C6352]">
                    Stok: <span className="font-medium text-red-600">{sf.currentStock} pcs</span>
                    {" · "}Dibutuhkan: <span className="font-medium">{sf.needed} pcs</span>
                    {" · "}Kurang: <span className="font-medium text-amber-700">{sf.needed - sf.currentStock} pcs</span>
                  </p>
                </div>
              ))}
            </div>
            <p className="mb-4 text-sm text-[#7C6352]">
              Produksi otomatis akan deduct bahan baku sesuai resep.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleProduceAndSell}
                loading={producePending}
                className="w-full"
              >
                Produksi & Jual
              </Button>
              <Button
                variant="secondary"
                onClick={() => { setStockConfirm(null); void executeSale(stockConfirm.payload); }}
                disabled={producePending}
                className="w-full"
              >
                Jual Tetap (stok negatif)
              </Button>
              <Button
                variant="ghost"
                onClick={() => setStockConfirm(null)}
                disabled={producePending}
                className="w-full"
              >
                Batal
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Receipt Modal (setelah save) ────────────────────────────────────────── */}
      {receipt && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={() => setReceipt(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-[#D9CCAF]" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 shrink-0">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 size={16} />
                <span className="text-sm font-semibold">Transaksi Tersimpan</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => printFromReceipt(receipt, false)}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#7C6352] bg-[#FBF8F2] border border-[#D9CCAF] rounded-lg px-3 py-1.5"
                >
                  <Printer size={13} /> Struk
                </button>
                <button
                  onClick={() => printFromReceipt(receipt, true)}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#7C6352] bg-[#FBF8F2] border border-[#D9CCAF] rounded-lg px-3 py-1.5"
                >
                  <Printer size={13} /> Kasir
                </button>
                <button
                  onClick={handleShareReceipt}
                  disabled={sharing}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#7C6352] bg-[#FBF8F2] border border-[#D9CCAF] rounded-lg px-3 py-1.5 disabled:opacity-50"
                >
                  {sharing ? "..." : <><Share2 size={13} /> Kirim</>}
                </button>
                <button
                  onClick={() => setReceipt(null)}
                  className="p-1.5 text-[#B88D6A] hover:text-[#7C6352] rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              <div
                ref={receiptRef}
                style={{ padding: "16px 16px 24px", backgroundColor: "#fdf6ee" }}
              >
                <div
                  style={{
                    borderRadius: 16,
                    overflow: "hidden",
                    border: "1px solid #D9CCAF",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: "#FBF8F2",
                      padding: "16px 20px",
                      textAlign: "center",
                    }}
                  >
                    <img
                      src="/td-logo.png"
                      alt="Logo"
                      style={{
                        display: "block",
                        margin: "0 auto 8px",
                        width: 52,
                        height: 52,
                        borderRadius: 12,
                        objectFit: "contain",
                        backgroundColor: "#A05035",
                        padding: 4,
                      }}
                    />
                    <p
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: "#2C1810",
                        marginBottom: 2,
                      }}
                    >
                      {storeName}
                    </p>
                    <p style={{ fontSize: 10, color: "#B88D6A", marginBottom: 6 }}>
                      Tata Data Dapur
                    </p>
                    <p style={{ fontSize: 10, color: "#7C6352", display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "0 6px" }}>
                      <span>{format(new Date(receipt.date), "dd MMM yyyy")}</span>
                      {receipt.categoryName && <><span style={{ color: "#D9CCAF" }}>·</span><span>{receipt.categoryName}</span></>}
                    </p>
                  </div>
                  <div style={{ backgroundColor: "#fff", padding: "16px 20px" }}>
                    {receipt.items.map((item, i) => (
                      <div
                        key={i}
                        style={{
                          paddingBottom: 10,
                          marginBottom: 10,
                          borderBottom: "1px solid #F5EFE0",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 14,
                              color: "#2C1810",
                              fontWeight: 600,
                            }}
                          >
                            {item.quantity}× {item.recipeName}
                          </span>
                          <span
                            style={{
                              fontSize: 14,
                              color: "#2C1810",
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {formatCurrency(item.sellingPrice * item.quantity)}
                          </span>
                        </div>
                        {item.addons.map((a, ai) => (
                          <p
                            key={ai}
                            style={{
                              fontSize: 11,
                              color: "#7C6352",
                              paddingLeft: 16,
                              marginTop: 3,
                            }}
                          >
                            + {a.name} ({a.qty}×)
                          </p>
                        ))}
                      </div>
                    ))}
                    <div style={{ borderTop: "2px dashed #D9CCAF", marginBottom: 12 }} />
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{ fontSize: 13, fontWeight: 600, color: "#7C6352" }}
                      >
                        Total
                      </span>
                      <span
                        style={{
                          fontSize: 22,
                          fontWeight: 700,
                          color: "#2C1810",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatCurrency(
                          receipt.items.reduce(
                            (s, i) => s + i.sellingPrice * i.quantity,
                            0,
                          ),
                        )}
                      </span>
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
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={() => setInvoiceSale(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-[#D9CCAF]" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 shrink-0">
              <p className="text-sm font-semibold text-[#2C1810]">Invoice</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => printFromSale(invoiceSale, false)}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#7C6352] bg-[#FBF8F2] border border-[#D9CCAF] rounded-lg px-3 py-1.5"
                >
                  <Printer size={13} /> Struk
                </button>
                <button
                  onClick={() => printFromSale(invoiceSale, true)}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#7C6352] bg-[#FBF8F2] border border-[#D9CCAF] rounded-lg px-3 py-1.5"
                >
                  <Printer size={13} /> Kasir
                </button>
                <button
                  onClick={handleShareInvoice}
                  disabled={sharing}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#7C6352] bg-[#FBF8F2] border border-[#D9CCAF] rounded-lg px-3 py-1.5 disabled:opacity-50"
                >
                  {sharing ? "..." : <><Share2 size={13} /> Kirim</>}
                </button>
                <button
                  onClick={() => setInvoiceSale(null)}
                  className="p-1.5 text-[#B88D6A] hover:text-[#7C6352] rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              <div
                ref={invoiceRef}
                style={{ padding: "16px 16px 24px", backgroundColor: "#fdf6ee" }}
              >
                <div
                  style={{
                    borderRadius: 16,
                    overflow: "hidden",
                    border: "1px solid #D9CCAF",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: "#FBF8F2",
                      padding: "16px 20px",
                      textAlign: "center",
                    }}
                  >
                    <img
                      src="/td-logo.png"
                      alt="Logo"
                      style={{
                        display: "block",
                        margin: "0 auto 8px",
                        width: 52,
                        height: 52,
                        borderRadius: 12,
                        objectFit: "contain",
                        backgroundColor: "#A05035",
                        padding: 4,
                      }}
                    />
                    <p
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: "#2C1810",
                        marginBottom: 2,
                      }}
                    >
                      {storeName}
                    </p>
                    <p style={{ fontSize: 10, color: "#B88D6A", marginBottom: 6 }}>
                      Tata Data Dapur
                    </p>
                    <p style={{ fontSize: 10, color: "#7C6352", display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "0 6px" }}>
                      <span>{format(new Date(invoiceSale.created_at), "dd MMM yyyy")}</span>
                      {(invoiceSale as any).category?.name && <><span style={{ color: "#D9CCAF" }}>·</span><span>{(invoiceSale as any).category.name}</span></>}
                      <span style={{ color: "#D9CCAF" }}>·</span>
                      <span style={{ fontFamily: "monospace", color: "#B88D6A" }}>#{invoiceSale.id.slice(0, 8).toUpperCase()}</span>
                    </p>
                  </div>
                  <div style={{ backgroundColor: "#fff", padding: "16px 20px" }}>
                    {(invoiceSale.sale_items ?? []).map((si) => (
                      <div
                        key={si.id}
                        style={{
                          paddingBottom: 10,
                          marginBottom: 10,
                          borderBottom: "1px solid #F5EFE0",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 14,
                              color: "#2C1810",
                              fontWeight: 600,
                            }}
                          >
                            {si.quantity_sold}× {(si.recipe as any)?.name ?? "—"}
                          </span>
                          <span
                            style={{
                              fontSize: 14,
                              color: "#2C1810",
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {formatCurrency(si.selling_price * si.quantity_sold)}
                          </span>
                        </div>
                        {(si.sale_addons ?? []).map((a) => (
                          <p
                            key={a.id}
                            style={{
                              fontSize: 11,
                              color: "#7C6352",
                              paddingLeft: 16,
                              marginTop: 3,
                            }}
                          >
                            + {a.name_at_sale} ({a.quantity}×)
                          </p>
                        ))}
                      </div>
                    ))}
                    <div style={{ borderTop: "2px dashed #D9CCAF", marginBottom: 12 }} />
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{ fontSize: 13, fontWeight: 600, color: "#7C6352" }}
                      >
                        Total
                      </span>
                      <span
                        style={{
                          fontSize: 22,
                          fontWeight: 700,
                          color: "#2C1810",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatCurrency(
                          (invoiceSale.sale_items ?? []).reduce(
                            (s, si) => s + si.selling_price * si.quantity_sold,
                            0,
                          ),
                        )}
                      </span>
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
