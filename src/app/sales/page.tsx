"use client";

export const dynamic = "force-dynamic";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useRecipes } from "@/hooks/useRecipes";
import { useCreateSale, useSales } from "@/hooks/useSales";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { Plus, TrendingUp } from "lucide-react";
import { useState } from "react";

export default function SalesPage() {
  const { data: sales, isLoading } = useSales();
  const { data: recipes } = useRecipes();
  const createSale = useCreateSale();

  const [modalOpen, setModalOpen] = useState(false);
  const [recipeId, setRecipeId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [sellingPrice, setSellingPrice] = useState("");

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

  return (
    <AppLayout
      title="Sales"
      action={
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" /> Record Sale
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <p className="text-sm text-slate-500">
            Sales history with auto-calculated profit
          </p>
        </CardHeader>
        <CardBody className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-slate-400">
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
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Recipe
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Qty
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Sell Price
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                      HPP
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Profit
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden sm:table-cell">
                      Margin
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s) => {
                    const saleMargin =
                      s.selling_price > 0
                        ? (s.profit / s.selling_price) * 100
                        : 0;
                    return (
                      <tr
                        key={s.id}
                        className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-6 py-3 font-medium text-slate-800">
                          {(s.recipe as any)?.name ?? "—"}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums text-slate-600">
                          {s.quantity_sold}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums text-slate-700">
                          {formatCurrency(s.selling_price)}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums text-slate-500">
                          {formatCurrency(s.hpp_at_sale)}
                        </td>
                        <td
                          className={`px-6 py-3 text-right tabular-nums font-semibold ${s.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}
                        >
                          {formatCurrency(s.profit * s.quantity_sold)}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums hidden sm:table-cell">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${saleMargin >= 30 ? "bg-emerald-50 text-emerald-700" : saleMargin >= 15 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}
                          >
                            {saleMargin.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right text-slate-400 text-xs hidden md:table-cell">
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
              className={`rounded-lg px-4 py-3 border text-xs space-y-1 ${totalProfit >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}
            >
              <div className="flex justify-between">
                <span className="text-slate-600">Revenue</span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(totalRevenue)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">HPP (total)</span>
                <span className="tabular-nums">
                  {formatCurrency(hpp * Number(quantity))}
                </span>
              </div>
              <div
                className={`flex justify-between font-bold border-t pt-1 ${totalProfit >= 0 ? "border-emerald-200 text-emerald-700" : "border-red-200 text-red-700"}`}
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
