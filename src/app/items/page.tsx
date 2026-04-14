"use client";

export const dynamic = "force-dynamic";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  useCreateItem,
  useDeleteItem,
  useItems,
  useUpdateItem,
} from "@/hooks/useItems";
import { Item } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

const UNITS: Item["unit"][] = ["gr", "ml", "pcs", "kg", "liter"];

export default function ItemsPage() {
  const { data: items, isLoading } = useItems();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<Item["unit"]>("gr");

  function openCreate() {
    setEditing(null);
    setName("");
    setUnit("gr");
    setModalOpen(true);
  }

  function openEdit(item: Item) {
    setEditing(item);
    setName(item.name);
    setUnit(item.unit);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (editing) {
      await updateItem.mutateAsync({ id: editing.id, name: name.trim(), unit });
    } else {
      await createItem.mutateAsync({ name: name.trim(), unit });
    }
    setModalOpen(false);
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this item?")) return;
    deleteItem.mutate(id);
  }

  return (
    <AppLayout
      title="Items"
      action={
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Add Item
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <p className="text-sm text-[#7C6352]">
            Raw materials and ingredients
          </p>
        </CardHeader>
        <CardBody className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-[#B88D6A]">
              Loading...
            </div>
          ) : !items?.length ? (
            <EmptyState
              icon={Package}
              title="No items yet"
              description="Add raw materials to track costs and inventory."
              action={
                <Button size="sm" onClick={openCreate}>
                  <Plus className="w-4 h-4" /> Add Item
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E5DACA]">
                    <th className="text-left px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                      Name
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                      Unit
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                      Avg Price/Unit
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                      Stock
                    </th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-[#EDE4CF] hover:bg-[#F5EFE0] transition-colors"
                    >
                      <td className="px-6 py-3 font-medium text-[#2C1810]">
                        {item.name}
                      </td>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#EDE4CF] text-[#5C4535]">
                          {item.unit}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums text-[#4A3728]">
                        {formatCurrency(item.avg_price)}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums text-[#4A3728]">
                        {item.stock} {item.unit}
                      </td>
                      <td className="px-6 py-3">
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
                            aria-label="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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
        title={editing ? "Edit Item" : "Add Item"}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Item Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Wheat Flour"
          />
          <Select
            label="Unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value as Item["unit"])}
            required
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
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
              loading={createItem.isPending || updateItem.isPending}
              className="flex-1"
            >
              {editing ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
