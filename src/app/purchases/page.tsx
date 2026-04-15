"use client";

export const dynamic = "force-dynamic";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useItems } from "@/hooks/useItems";
import { useCreatePurchase, usePurchases } from "@/hooks/usePurchases";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { Plus, ShoppingCart } from "lucide-react";
import { useState } from "react";

export default function PurchasesPage() {
  const { data: purchases, isLoading } = usePurchases();
  const { data: items } = useItems();
  const createPurchase = useCreatePurchase();

  const [modalOpen, setModalOpen] = useState(false);
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [totalPrice, setTotalPrice] = useState("");

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

  return (
    <AppLayout
      title="Purchases"
      action={
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" /> Add Purchase
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <p className="text-sm text-[#7C6352]">
            Purchase history — auto-updates weighted average price
          </p>
        </CardHeader>
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
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E5DACA]">
                    <th className="text-left px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                      Item
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                      Qty
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                      Total Price
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                      Price/Unit
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide hidden sm:table-cell">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-[#EDE4CF] hover:bg-[#F5EFE0] transition-colors"
                    >
                      <td className="px-6 py-3 font-medium text-[#2C1810]">
                        {(p.item as any)?.name ?? "—"}
                        <span className="ml-1.5 text-xs text-[#B88D6A]">
                          {(p.item as any)?.unit}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums text-[#5C4535]">
                        {p.quantity}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums font-medium text-[#2C1810]">
                        {formatCurrency(p.total_price)}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums text-[#5C4535]">
                        {formatCurrency(p.price_per_unit)}
                      </td>
                      <td className="px-6 py-3 text-right text-[#B88D6A] text-xs hidden sm:table-cell">
                        {format(new Date(p.created_at), "dd MMM yyyy")}
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
                <span className="font-bold">
                  {formatCurrency(pricePerUnit)}
                </span>
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
