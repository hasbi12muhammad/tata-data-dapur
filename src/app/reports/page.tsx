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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";

export default function ReportsPage() {
  const { data: stats } = useDashboardStats();
  const { data: sales } = useSales();
  const { data: recipes } = useRecipes();

  // Revenue per day (last 7 days)
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

  // Top recipes by profit
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
      <div className="space-y-6">
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
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={last7}
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5DACA" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatCurrency(Number(value)),
                    name === "revenue" ? "Revenue" : "Profit",
                  ]}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                  }}
                />
                <Bar
                  dataKey="revenue"
                  fill="#A05035"
                  radius={[4, 4, 0, 0]}
                  name="revenue"
                />
                <Bar
                  dataKey="profit"
                  fill="#737B4C"
                  radius={[4, 4, 0, 0]}
                  name="profit"
                />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 justify-center">
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E5DACA]">
                    <th className="text-left px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                      Recipe
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                      HPP
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                      Revenue
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                      Profit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recipeProfit.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-[#EDE4CF] hover:bg-[#F5EFE0] transition-colors"
                    >
                      <td className="px-6 py-3 font-medium text-[#2C1810]">
                        {r.name}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums text-[#7C6352]">
                        {formatCurrency(r.hpp)}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums text-[#4A3728]">
                        {formatCurrency(r.revenue)}
                      </td>
                      <td
                        className={`px-6 py-3 text-right tabular-nums font-semibold ${r.profit >= 0 ? "text-[#737B4C]" : "text-[#C0392B]"}`}
                      >
                        {formatCurrency(r.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      </div>
    </AppLayout>
  );
}
