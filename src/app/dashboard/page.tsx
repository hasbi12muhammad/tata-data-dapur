"use client";

export const dynamic = "force-dynamic";

import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useDashboardStats, useSales } from "@/hooks/useSales";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  BarChart3,
  DollarSign,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: sales } = useSales();

  const recentSales = sales?.slice(0, 8) ?? [];

  return (
    <AppLayout title="Dashboard">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard
          label="Total Revenue"
          value={
            statsLoading ? "..." : formatCurrency(stats?.total_revenue ?? 0)
          }
          icon={DollarSign}
          accent="blue"
        />
        <StatCard
          label="Total HPP"
          value={statsLoading ? "..." : formatCurrency(stats?.total_hpp ?? 0)}
          icon={TrendingDown}
          accent="amber"
        />
        <StatCard
          label="Total Profit"
          value={
            statsLoading ? "..." : formatCurrency(stats?.total_profit ?? 0)
          }
          icon={TrendingUp}
          accent="green"
        />
        <StatCard
          label="Profit Margin"
          value={
            statsLoading
              ? "..."
              : `${formatNumber(stats?.profit_margin ?? 0, 1)}%`
          }
          icon={BarChart3}
          accent={
            (stats?.profit_margin ?? 0) >= 30
              ? "green"
              : (stats?.profit_margin ?? 0) >= 15
                ? "amber"
                : "red"
          }
          sub={`${stats?.sales_count ?? 0} transactions`}
        />
      </div>

      {/* Recent sales table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">
              Recent Sales
            </h2>
            <a
              href="/sales"
              className="text-xs text-[#1E3A5F] hover:underline font-medium"
            >
              View all
            </a>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {recentSales.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No sales yet</p>
              </div>
            </div>
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
                      Revenue
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Profit
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden sm:table-cell">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-3 font-medium text-slate-800">
                        {(s.recipe as any)?.name ?? "—"}
                      </td>
                      <td className="px-6 py-3 text-right text-slate-600 tabular-nums">
                        {s.quantity_sold}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums font-medium text-slate-800">
                        {formatCurrency(s.selling_price * s.quantity_sold)}
                      </td>
                      <td
                        className={`px-6 py-3 text-right tabular-nums font-semibold ${s.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {formatCurrency(s.profit * s.quantity_sold)}
                      </td>
                      <td className="px-6 py-3 text-right text-slate-400 text-xs hidden sm:table-cell">
                        {format(new Date(s.created_at), "dd MMM")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </AppLayout>
  );
}
