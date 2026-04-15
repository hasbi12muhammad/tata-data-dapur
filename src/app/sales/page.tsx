"use client";

export const dynamic = "force-dynamic";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useRecipes } from "@/hooks/useRecipes";
import { useCreateSale, useSales } from "@/hooks/useSales";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { Plus, Search, TrendingUp, X } from "lucide-react";
import { useMemo, useState } from "react";

const cls =
  "h-9 rounded-lg border border-[#D9CCAF] bg-[#FBF8F2] px-3 text-sm text-[#2C1810] placeholder:text-[#B88D6A] focus:outline-none focus:ring-2 focus:ring-[#A05035] focus:border-transparent";

export default function SalesPage() {
  const { data: sales, isLoading } = useSales();
  const { data: recipes } = useRecipes();
  const createSale = useCreateSale();

  // ── form state ──────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [recipeId, setRecipeId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [sellingPrice, setSellingPrice] = useState("");

  // ── filter / sort state ──────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filterRecipe, setFilterRecipe] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");

  const selectedRecipe = recipes?.find((r) => r.id === recipeId);
  const hpp = selectedRecipe?.hpp ?? 0;
  const totalRevenue = Number(sellingPrice) * Number(quantity);
  const totalProfit = (Number(sellingPrice) - hpp) * Number(quantity);
  const margin =
    Number(sellingPrice) > 0
      ? ((Number(sellingPrice) - hpp) / Number(sellingPrice)) * 100
      : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recipeId || !sellingPrice) return;
    await createSale.mutateAsync({
      recipe_id: recipeId,
      quantity_sold: Number(quantity),
      selling_price: Number(sellingPrice),
      hpp_at_sale: hpp,
    });
    setModalOpen(false);
    setRecipeId("");
    setQuantity("1");
    setSellingPrice("");
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

    return [...rows].sort((a, b) => {
      const profitA = a.profit * a.quantity_sold;
      const profitB = b.profit * b.quantity_sold;
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
  }, [sales, search, filterRecipe, sortBy]);

  const hasFilters = search || filterRecipe || sortBy !== "date_desc";

  return (
    <AppLayout
      title="Sales"
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
              placeholder="Search recipe..."
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
              <option value="profit_desc">Profit ↑</option>
              <option value="profit_asc">Profit ↓</option>
              <option value="revenue_desc">Revenue ↑</option>
              <option value="qty_desc">Qty terbanyak</option>
            </select>
            <select
              className={`${cls} flex-1`}
              value={filterRecipe}
              onChange={(e) => setFilterRecipe(e.target.value)}
            >
              <option value="">Semua resep</option>
              {recipes?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
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
          ) : !sales?.length ? (
            <EmptyState
              icon={TrendingUp}
              title="No sales yet"
              description="Record a sale to start tracking revenue and profit."
              action={
                <Button size="sm" onClick={() => setModalOpen(true)}>
                  <Plus className="w-4 h-4" /> Record Sale
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#B88D6A]">
              Tidak ada hasil untuk filter ini
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[420px]">
                <thead>
                  <tr className="border-b border-[#E5DACA]">
                    <th className="text-left px-4 sm:px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                      Recipe
                    </th>
                    <th className="text-right px-2 sm:px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                      Qty
                    </th>
                    <th className="text-right px-2 sm:px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide hidden sm:table-cell">
                      Sell Price
                    </th>
                    <th className="text-right px-2 sm:px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide hidden sm:table-cell">
                      HPP
                    </th>
                    <th className="text-right px-3 sm:px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                      Profit
                    </th>
                    <th className="text-right px-3 sm:px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide hidden md:table-cell">
                      Margin
                    </th>
                    <th className="text-right px-4 sm:px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide hidden md:table-cell">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const saleMargin =
                      s.selling_price > 0
                        ? (s.profit / s.selling_price) * 100
                        : 0;
                    return (
                      <tr
                        key={s.id}
                        className="border-b border-[#EDE4CF] last:border-0 hover:bg-[#F5EFE0] transition-colors"
                      >
                        <td className="px-4 sm:px-6 py-2.5 sm:py-3 font-medium text-[#2C1810]">
                          <span className="line-clamp-1">
                            {(s.recipe as any)?.name ?? "—"}
                          </span>
                        </td>
                        <td className="px-2 sm:px-6 py-2.5 sm:py-3 text-right tabular-nums text-[#5C4535] text-xs sm:text-sm">
                          {s.quantity_sold}
                        </td>
                        <td className="px-2 sm:px-6 py-2.5 sm:py-3 text-right tabular-nums text-[#4A3728] text-xs hidden sm:table-cell whitespace-nowrap">
                          {formatCurrency(s.selling_price)}
                        </td>
                        <td className="px-2 sm:px-6 py-2.5 sm:py-3 text-right tabular-nums text-[#7C6352] text-xs hidden sm:table-cell whitespace-nowrap">
                          {formatCurrency(s.hpp_at_sale)}
                        </td>
                        <td
                          className={`px-3 sm:px-6 py-2.5 sm:py-3 text-right tabular-nums font-semibold text-xs sm:text-sm whitespace-nowrap ${s.profit >= 0 ? "text-[#737B4C]" : "text-red-600"}`}
                        >
                          {formatCurrency(s.profit * s.quantity_sold)}
                        </td>
                        <td className="px-3 sm:px-6 py-2.5 sm:py-3 text-right hidden md:table-cell">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${saleMargin >= 30 ? "bg-[#737B4C]/10 text-[#5C6B38]" : saleMargin >= 15 ? "bg-[#B88D6A]/10 text-[#7C563D]" : "bg-red-50 text-red-700"}`}
                          >
                            {saleMargin.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-2.5 sm:py-3 text-right text-[#B88D6A] text-xs hidden md:table-cell whitespace-nowrap">
                          {format(new Date(s.created_at), "dd MMM yyyy")}
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
        title="Record Sale"
        size="sm"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Select
            label="Recipe / Product"
            value={recipeId}
            onChange={(e) => setRecipeId(e.target.value)}
            required
          >
            <option value="">Select recipe...</option>
            {recipes?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} — HPP {formatCurrency(r.hpp)}
              </option>
            ))}
          </Select>
          <Input
            label="Quantity Sold"
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
          <Input
            label="Selling Price per Unit (IDR)"
            type="number"
            min="0"
            value={sellingPrice}
            onChange={(e) => setSellingPrice(e.target.value)}
            required
          />
          {selectedRecipe && Number(sellingPrice) > 0 && (
            <div
              className={`rounded-lg px-4 py-3 border text-xs space-y-1 ${totalProfit >= 0 ? "bg-[#737B4C]/10 border-[#737B4C]/20" : "bg-red-50 border-red-100"}`}
            >
              <div className="flex justify-between">
                <span className="text-[#5C4535]">Revenue</span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(totalRevenue)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5C4535]">HPP (total)</span>
                <span className="tabular-nums">
                  {formatCurrency(hpp * Number(quantity))}
                </span>
              </div>
              <div
                className={`flex justify-between font-bold border-t pt-1 ${totalProfit >= 0 ? "border-[#737B4C]/30 text-[#5C6B38]" : "border-red-200 text-red-700"}`}
              >
                <span>Profit</span>
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
              onClick={() => setModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createSale.isPending}
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
