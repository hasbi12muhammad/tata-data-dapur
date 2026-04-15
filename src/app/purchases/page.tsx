"use client";

export const dynamic = "force-dynamic";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useItems } from "@/hooks/useItems";
import { useCreatePurchase, usePurchases } from "@/hooks/usePurchases";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { Plus, Search, ShoppingCart, X } from "lucide-react";
import { useMemo, useState } from "react";

const cls =
  "h-9 rounded-lg border border-[#D9CCAF] bg-[#FBF8F2] px-3 text-sm text-[#2C1810] placeholder:text-[#B88D6A] focus:outline-none focus:ring-2 focus:ring-[#A05035] focus:border-transparent";

export default function PurchasesPage() {
  const { data: purchases, isLoading } = usePurchases();
  const { data: items } = useItems();
  const createPurchase = useCreatePurchase();

  // ── form state ──────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [totalPrice, setTotalPrice] = useState("");

  // ── filter / sort state ──────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filterItem, setFilterItem] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");

  const pricePerUnit =
    quantity && totalPrice && Number(quantity) > 0
      ? Number(totalPrice) / Number(quantity)
      : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!itemId || !quantity || !totalPrice) return;
    if (Number(quantity) <= 0) return;
    if (Number(totalPrice) < 0) return;
    await createPurchase.mutateAsync({
      item_id: itemId,
      quantity: Number(quantity),
      total_price: Number(totalPrice),
    });
    setModalOpen(false);
    setItemId("");
    setQuantity("");
    setTotalPrice("");
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

    return [...rows].sort((a, b) => {
      switch (sortBy) {
        case "date_asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "price_desc":
          return b.total_price - a.total_price;
        case "price_asc":
          return a.total_price - b.total_price;
        case "qty_desc":
          return b.quantity - a.quantity;
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [purchases, search, filterItem, sortBy]);

  const hasFilters = search || filterItem || sortBy !== "date_desc";

  return (
    <AppLayout
      title="Purchases"
      action={
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" /> Add
        </Button>
      }
    >
      <Card>
        {/* Filter bar */}
        <div className="px-4 py-3 border-b border-[#E5DACA] space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#B88D6A]" />
            <input
              className={`${cls} w-full pl-8`}
              placeholder="Search item..."
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
          <div className="flex gap-2">
            <select
              className={`${cls} flex-1`}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="date_desc">Terbaru</option>
              <option value="date_asc">Terlama</option>
              <option value="price_desc">Harga ↑</option>
              <option value="price_asc">Harga ↓</option>
              <option value="qty_desc">Qty terbanyak</option>
            </select>
            <select
              className={`${cls} flex-1`}
              value={filterItem}
              onChange={(e) => setFilterItem(e.target.value)}
            >
              <option value="">Semua item</option>
              {items?.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
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
                }}
                className="text-[#A05035] hover:underline font-medium"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <CardBody className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-[#B88D6A]">
              Loading...
            </div>
          ) : !purchases?.length ? (
            <EmptyState
              icon={ShoppingCart}
              title="No purchases yet"
              description="Record a purchase to start tracking ingredient costs."
              action={
                <Button size="sm" onClick={() => setModalOpen(true)}>
                  <Plus className="w-4 h-4" /> Add Purchase
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#B88D6A]">
              Tidak ada hasil untuk filter ini
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E5DACA]">
                    <th className="text-left px-2 sm:px-6 py-3 text-[10px] sm:text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                      Item
                    </th>
                    <th className="text-right px-2 sm:px-6 py-3 text-[10px] sm:text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                      Qty
                    </th>
                    <th className="text-right px-2 sm:px-6 py-3 text-[10px] sm:text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                      Total
                    </th>
                    <th className="text-right px-2 sm:px-6 py-3 text-[10px] sm:text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                      /Unit
                    </th>
                    <th className="text-right px-2 sm:px-6 py-3 text-[10px] sm:text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-[#EDE4CF] last:border-0 hover:bg-[#F5EFE0] transition-colors"
                    >
                      <td className="px-2 sm:px-6 py-2 sm:py-3 font-medium text-[#2C1810]">
                        <span className="line-clamp-1 text-xs sm:text-sm">
                          {(p.item as any)?.name ?? "—"}
                        </span>
                        <span className="text-[10px] text-[#B88D6A] hidden sm:block">
                          {(p.item as any)?.unit}
                        </span>
                      </td>
                      <td className="px-2 sm:px-6 py-2 sm:py-3 text-right tabular-nums text-[#5C4535] text-xs sm:text-sm">
                        {p.quantity}
                      </td>
                      <td className="px-2 sm:px-6 py-2 sm:py-3 text-right tabular-nums font-medium text-[#2C1810] text-xs sm:text-sm whitespace-nowrap">
                        {formatCurrency(p.total_price)}
                      </td>
                      <td className="px-2 sm:px-6 py-2 sm:py-3 text-right tabular-nums text-[#5C4535] text-xs whitespace-nowrap">
                        {formatCurrency(p.price_per_unit)}
                      </td>
                      <td className="px-2 sm:px-6 py-2 sm:py-3 text-right text-[#B88D6A] text-xs whitespace-nowrap">
                        <span className="sm:hidden">{format(new Date(p.created_at), "dd/MM")}</span>
                        <span className="hidden sm:inline">{format(new Date(p.created_at), "dd MMM yyyy")}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record Purchase"
        size="sm"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Select
            label="Item"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            required
          >
            <option value="">Select item...</option>
            {items?.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.unit})
              </option>
            ))}
          </Select>
          <Input
            label="Quantity"
            type="number"
            min="0.01"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
          <Input
            label="Total Price (IDR)"
            type="number"
            min="0"
            value={totalPrice}
            onChange={(e) => setTotalPrice(e.target.value)}
            required
          />
          {pricePerUnit > 0 && (
            <div className="rounded-lg bg-[#737B4C]/10 border border-[#737B4C]/20 px-4 py-2.5">
              <p className="text-xs text-[#5C6B38] font-medium">
                Price per unit:{" "}
                <span className="font-bold">{formatCurrency(pricePerUnit)}</span>
              </p>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createPurchase.isPending}
              className="flex-1"
            >
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
