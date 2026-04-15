"use client";

export const dynamic = "force-dynamic";

import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { useDashboardStats, useSales } from "@/hooks/useSales";
import { useRecipes } from "@/hooks/useRecipes";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { BarChart3, DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#2C1810] text-[#F5EFE0] rounded-lg px-3 py-2.5 text-xs shadow-xl border border-[#4A3728]">
      <p className="font-semibold text-[#D9CCAF] mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-sm inline-block flex-shrink-0"
            style={{ backgroundColor: p.dataKey === "revenue" ? "#C0714F" : "#8E9960" }}
          />
          <span className="text-[#E9DFC6]">
            {p.dataKey === "revenue" ? "Revenue" : "Profit"}:{" "}
          </span>
          <span className="font-semibold">{formatCurrency(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const { data: stats } = useDashboardStats();
  const { data: sales } = useSales();
  const { data: recipes } = useRecipes();

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const day = startOfDay(subDays(new Date(), 6 - i));
    const label = format(day, "dd/MM");
    const daySales = (sales ?? []).filter(
      (s) =>
        format(new Date(s.created_at), "dd/MM/yyyy") ===
        format(day, "dd/MM/yyyy"),
    );
    const revenue = daySales.reduce(
      (sum, s) => sum + s.selling_price * s.quantity_sold,
      0,
    );
    const profit = daySales.reduce(
      (sum, s) => sum + s.profit * s.quantity_sold,
      0,
    );
    return { label, revenue, profit };
  });

  const recipeProfit = (recipes ?? [])
    .map((r) => {
      const recipeSales = (sales ?? []).filter((s) => s.recipe_id === r.id);
      const totalProfit = recipeSales.reduce(
        (sum, s) => sum + s.profit * s.quantity_sold,
        0,
      );
      const totalRevenue = recipeSales.reduce(
        (sum, s) => sum + s.selling_price * s.quantity_sold,
        0,
      );
      return {
        id: r.id,
        name: r.name,
        profit: totalProfit,
        revenue: totalRevenue,
        hpp: r.hpp,
      };
    })
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  return (
    <AppLayout title="Reports">
      <div className="space-y-4 sm:space-y-6">
        {/* KPI summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Total Revenue"
            value={formatCurrency(stats?.total_revenue ?? 0)}
            icon={DollarSign}
            accent="dune"
          />
          <StatCard
            label="Total HPP"
            value={formatCurrency(stats?.total_hpp ?? 0)}
            icon={TrendingDown}
            accent="clay"
          />
          <StatCard
            label="Total Profit"
            value={formatCurrency(stats?.total_profit ?? 0)}
            icon={TrendingUp}
            accent="verde"
          />
          <StatCard
            label="Profit Margin"
            value={`${formatNumber(stats?.profit_margin ?? 0, 1)}%`}
            icon={BarChart3}
            accent={(stats?.profit_margin ?? 0) >= 30 ? "verde" : "clay"}
            sub={`${stats?.sales_count ?? 0} total sales`}
          />
        </div>

        {/* Revenue chart */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[#2C1810]">
              Revenue & Profit — Last 7 Days
            </h2>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={last7}
                margin={{ top: 4, right: 4, left: -8, bottom: 0 }}
                barGap={3}
                barSize={14}
              >
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#A05035" stopOpacity={1} />
                    <stop offset="100%" stopColor="#C0714F" stopOpacity={0.75} />
                  </linearGradient>
                  <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#737B4C" stopOpacity={1} />
                    <stop offset="100%" stopColor="#8E9960" stopOpacity={0.75} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E5DACA"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#B88D6A" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#B88D6A" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v >= 1_000_000
                      ? `${(v / 1_000_000).toFixed(0)}jt`
                      : `${(v / 1000).toFixed(0)}k`
                  }
                  width={36}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "#E9DFC6", opacity: 0.5 }} />
                <Bar dataKey="revenue" fill="url(#gradRevenue)" radius={[5, 5, 0, 0]} name="revenue" />
                <Bar dataKey="profit" fill="url(#gradProfit)" radius={[5, 5, 0, 0]} name="profit" />
              </BarChart>
            </ResponsiveContainer>

            <div className="flex items-center gap-5 mt-3 justify-center">
              <span className="flex items-center gap-1.5 text-xs text-[#7C6352]">
                <span className="w-3 h-3 rounded-sm bg-[#A05035] inline-block" />
                Revenue
              </span>
              <span className="flex items-center gap-1.5 text-xs text-[#7C6352]">
                <span className="w-3 h-3 rounded-sm bg-[#737B4C] inline-block" />
                Profit
              </span>
            </div>
          </CardBody>
        </Card>

        {/* Top recipes */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[#2C1810]">
              Top Recipes by Profit
            </h2>
          </CardHeader>
          <CardBody className="p-0">
            {recipeProfit.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#B88D6A]">
                No data yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E5DACA]">
                      <th className="text-left px-4 sm:px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                        Recipe
                      </th>
                      <th className="text-right px-3 sm:px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                        HPP
                      </th>
                      <th className="text-right px-3 sm:px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                        Revenue
                      </th>
                      <th className="text-right px-4 sm:px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                        Profit
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipeProfit.map((r, i) => (
                      <tr
                        key={r.id}
                        className="border-b border-[#EDE4CF] last:border-0 hover:bg-[#F5EFE0] transition-colors"
                      >
                        <td className="px-4 sm:px-6 py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#E9DFC6] text-[#7C563D] text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                              {i + 1}
                            </span>
                            <span className="font-medium text-[#2C1810] text-xs sm:text-sm line-clamp-1">
                              {r.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 text-right tabular-nums text-[#7C6352] text-xs sm:text-sm whitespace-nowrap">
                          {formatCurrency(r.hpp)}
                        </td>
                        <td className="px-3 sm:px-6 py-3 text-right tabular-nums text-[#4A3728] text-xs sm:text-sm whitespace-nowrap">
                          {formatCurrency(r.revenue)}
                        </td>
                        <td
                          className={`px-4 sm:px-6 py-3 text-right tabular-nums font-semibold text-xs sm:text-sm whitespace-nowrap ${r.profit >= 0 ? "text-[#737B4C]" : "text-[#C0392B]"}`}
                        >
                          {formatCurrency(r.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </AppLayout>
  );
}
