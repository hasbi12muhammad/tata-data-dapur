"use client";

export const dynamic = "force-dynamic";

import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { useReportSales } from "@/hooks/useSales";
import { useReportExpenses } from "@/hooks/useExpenses";
import { useRecipes } from "@/hooks/useRecipes";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import * as XLSX from "xlsx";
import {
  BarChart3,
  DollarSign,
  Download,
  Receipt,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  addDays,
  differenceInDays,
  endOfDay,
  endOfMonth,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import { useMemo, useState } from "react";

// ── Period ───────────────────────────────────────────────────
type Preset = "today" | "7d" | "30d" | "thisMonth" | "lastMonth" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Hari ini" },
  { key: "7d", label: "7 Hari" },
  { key: "30d", label: "30 Hari" },
  { key: "thisMonth", label: "Bulan ini" },
  { key: "lastMonth", label: "Bulan lalu" },
  { key: "custom", label: "Custom" },
];

function getRange(preset: Preset, from: string, to: string): [Date, Date] {
  const now = new Date();
  switch (preset) {
    case "today":
      return [startOfDay(now), endOfDay(now)];
    case "7d":
      return [startOfDay(subDays(now, 6)), endOfDay(now)];
    case "30d":
      return [startOfDay(subDays(now, 29)), endOfDay(now)];
    case "thisMonth":
      return [startOfMonth(now), endOfDay(now)];
    case "lastMonth": {
      const lm = subMonths(now, 1);
      return [startOfMonth(lm), endOfMonth(lm)];
    }
    case "custom":
      return [
        from ? startOfDay(new Date(from)) : startOfDay(subDays(now, 6)),
        to ? endOfDay(new Date(to)) : endOfDay(now),
      ];
  }
}

// ── Tooltip ──────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const colorMap: Record<string, string> = {
    revenue: "#C0714F",
    grossProfit: "#8E9960",
    netProfit: "#3B7A57",
  };
  const labelMap: Record<string, string> = {
    revenue: "Revenue",
    grossProfit: "Gross Profit",
    netProfit: "Net Profit",
  };
  return (
    <div className="bg-[#2C1810] text-[#F5EFE0] rounded-lg px-3 py-2.5 text-xs shadow-xl border border-[#4A3728]">
      <p className="font-semibold text-[#D9CCAF] mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-sm inline-block flex-shrink-0"
            style={{ backgroundColor: colorMap[p.dataKey] ?? "#ccc" }}
          />
          <span className="text-[#E9DFC6]">
            {labelMap[p.dataKey] ?? p.dataKey}:{" "}
          </span>
          <span className="font-semibold">
            {formatCurrency(Number(p.value))}
          </span>
        </p>
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────
export default function ReportsPage() {
  const { data: allSales = [], isLoading: salesLoading } = useReportSales();
  const { data: allExpenses = [], isLoading: expLoading } = useReportExpenses();
  const { data: recipes } = useRecipes();

  const isLoading = salesLoading || expLoading;

  const [preset, setPreset] = useState<Preset>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [rangeFrom, rangeTo] = useMemo(
    () => getRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const filteredSales = useMemo(
    () =>
      allSales.filter((s) => {
        const d = new Date(s.created_at);
        return d >= rangeFrom && d <= rangeTo;
      }),
    [allSales, rangeFrom, rangeTo],
  );

  const filteredExpenses = useMemo(
    () =>
      allExpenses.filter((e) => {
        const d = new Date(e.created_at);
        return d >= rangeFrom && d <= rangeTo;
      }),
    [allExpenses, rangeFrom, rangeTo],
  );

  const stats = useMemo(() => {
    const total_revenue = filteredSales.reduce(
      (sum, s) => sum + s.selling_price * s.quantity_sold,
      0,
    );
    const total_hpp = filteredSales.reduce(
      (sum, s) => sum + s.hpp_at_sale * s.quantity_sold,
      0,
    );
    const gross_profit = total_revenue - total_hpp;
    const total_expenses = filteredExpenses.reduce(
      (sum, e) => sum + e.total,
      0,
    );
    const net_profit = gross_profit - total_expenses;
    return {
      total_revenue,
      total_hpp,
      gross_profit,
      total_expenses,
      net_profit,
      gross_margin:
        total_revenue > 0 ? (gross_profit / total_revenue) * 100 : 0,
      net_margin: total_revenue > 0 ? (net_profit / total_revenue) * 100 : 0,
      sales_count: filteredSales.length,
    };
  }, [filteredSales, filteredExpenses]);

  // Expense breakdown by category
  const expByCategory = useMemo(() => {
    const map: Record<string, { name: string; total: number }> = {};
    filteredExpenses.forEach((e) => {
      const key = e.category_id ?? "__none__";
      const name = e.category?.name ?? "Tanpa Kategori";
      if (!map[key]) map[key] = { name, total: 0 };
      map[key].total += e.total;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredExpenses]);

  // Daily (≤60 days) or weekly chart
  const chartData = useMemo(() => {
    const days = differenceInDays(rangeTo, rangeFrom) + 1;
    if (days <= 60) {
      return Array.from({ length: days }, (_, i) => {
        const day = startOfDay(addDays(rangeFrom, i));
        const ds = filteredSales.filter((s) =>
          isSameDay(new Date(s.created_at), day),
        );
        const de = filteredExpenses.filter((e) =>
          isSameDay(new Date(e.created_at), day),
        );
        const revenue = ds.reduce(
          (sum, s) => sum + s.selling_price * s.quantity_sold,
          0,
        );
        const hpp = ds.reduce(
          (sum, s) => sum + s.hpp_at_sale * s.quantity_sold,
          0,
        );
        const grossProfit = revenue - hpp;
        const expenses = de.reduce((sum, e) => sum + e.total, 0);
        return {
          label: format(day, "dd/MM"),
          revenue,
          grossProfit,
          netProfit: grossProfit - expenses,
        };
      });
    }
    // Weekly aggregation
    const weeks: Record<
      string,
      { label: string; revenue: number; grossProfit: number; netProfit: number }
    > = {};
    filteredSales.forEach((s) => {
      const d = new Date(s.created_at);
      const mon = startOfDay(subDays(d, (d.getDay() + 6) % 7));
      const key = format(mon, "yyyy-MM-dd");
      if (!weeks[key])
        weeks[key] = {
          label: format(mon, "dd/MM"),
          revenue: 0,
          grossProfit: 0,
          netProfit: 0,
        };
      weeks[key].revenue += s.selling_price * s.quantity_sold;
      const gp =
        s.selling_price * s.quantity_sold - s.hpp_at_sale * s.quantity_sold;
      weeks[key].grossProfit += gp;
      weeks[key].netProfit += gp;
    });
    filteredExpenses.forEach((e) => {
      const d = new Date(e.created_at);
      const mon = startOfDay(subDays(d, (d.getDay() + 6) % 7));
      const key = format(mon, "yyyy-MM-dd");
      if (weeks[key]) weeks[key].netProfit -= e.total;
    });
    return Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [filteredSales, filteredExpenses, rangeFrom, rangeTo]);

  const recipeProfit = useMemo(
    () =>
      (recipes ?? [])
        .map((r) => {
          const rs = filteredSales.filter((s) => s.recipe_id === r.id);
          return {
            id: r.id,
            name: r.name,
            hpp: r.hpp,
            revenue: rs.reduce(
              (sum, s) => sum + s.selling_price * s.quantity_sold,
              0,
            ),
            profit: rs.reduce((sum, s) => sum + s.profit * s.quantity_sold, 0),
          };
        })
        .filter((r) => r.revenue > 0)
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 5),
    [filteredSales, recipes],
  );

  const chartTitle = useMemo(() => {
    const map: Record<Preset, string> = {
      today: `Revenue & Profit — ${format(rangeFrom, "dd MMM yyyy")}`,
      "7d": "Revenue & Profit — 7 Hari Terakhir",
      "30d": "Revenue & Profit — 30 Hari Terakhir",
      thisMonth: `Revenue & Profit — ${format(rangeFrom, "MMMM yyyy")}`,
      lastMonth: `Revenue & Profit — ${format(rangeFrom, "MMMM yyyy")}`,
      custom: `Revenue & Profit — ${format(rangeFrom, "dd MMM")} – ${format(rangeTo, "dd MMM yyyy")}`,
    };
    return map[preset];
  }, [preset, rangeFrom, rangeTo]);

  function downloadXLSX() {
    const IDR = '"Rp "* #,##0';
    const isWeekly = differenceInDays(rangeTo, rangeFrom) > 60;
    const filename = `laporan_${format(rangeFrom, "yyyyMMdd")}_${format(rangeTo, "yyyyMMdd")}.xlsx`;
    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Ringkasan P&L ──
    const summaryRows: (string | number)[][] = [
      ["LAPORAN TATA DATA DAPUR"],
      [
        `Periode: ${format(rangeFrom, "dd MMM yyyy")} - ${format(rangeTo, "dd MMM yyyy")}`,
      ],
      [`Diunduh: ${format(new Date(), "dd MMM yyyy HH:mm")}`],
      [],
      ["Metrik", "Nilai"],
      ["Total Revenue", stats.total_revenue],
      ["Total HPP (COGS)", stats.total_hpp],
      ["Gross Profit", stats.gross_profit],
      ["Gross Margin (%)", stats.gross_margin],
      ["Total Expenses", stats.total_expenses],
      ["Net Profit", stats.net_profit],
      ["Net Margin (%)", stats.net_margin],
      ["Jumlah Transaksi", stats.sales_count],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
    // Currency format: rows 5,6,7,9,10 (0-indexed), col 1
    [5, 6, 7, 9, 10].forEach((r) => {
      const ref = XLSX.utils.encode_cell({ r, c: 1 });
      if (ws1[ref]) ws1[ref].z = IDR;
    });
    // Percent format: rows 8, 11
    [8, 11].forEach((r) => {
      const ref = XLSX.utils.encode_cell({ r, c: 1 });
      if (ws1[ref]) ws1[ref].z = '0.0"%"';
    });
    ws1["!cols"] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Ringkasan P&L");

    // ── Sheet 2: Rincian Harian/Mingguan ──
    const periodRows: (string | number)[][] = [
      ["Periode", "Revenue", "Gross Profit", "Net Profit"],
      ...chartData.map((d) => [d.label, d.revenue, d.grossProfit, d.netProfit]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(periodRows);
    chartData.forEach((_, i) => {
      [1, 2, 3].forEach((c) => {
        const ref = XLSX.utils.encode_cell({ r: i + 1, c });
        if (ws2[ref]) ws2[ref].z = IDR;
      });
    });
    ws2["!cols"] = [{ wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(
      wb,
      ws2,
      `Rincian ${isWeekly ? "Mingguan" : "Harian"}`,
    );

    // ── Sheet 3: Top Products ──
    const productRows: (string | number)[][] = [
      ["Product", "HPP", "Revenue", "Gross Profit"],
      ...recipeProfit.map((r) => [r.name, r.hpp, r.revenue, r.profit]),
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(productRows);
    recipeProfit.forEach((_, i) => {
      [1, 2, 3].forEach((c) => {
        const ref = XLSX.utils.encode_cell({ r: i + 1, c });
        if (ws3[ref]) ws3[ref].z = IDR;
      });
    });
    ws3["!cols"] = [{ wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws3, "Top Products");

    // ── Sheet 4: Expenses ──
    const expRows: (string | number)[][] = [
      ["Kategori", "Total"],
      ...expByCategory.map((c) => [c.name, c.total]),
    ];
    const ws4 = XLSX.utils.aoa_to_sheet(expRows);
    expByCategory.forEach((_, i) => {
      const ref = XLSX.utils.encode_cell({ r: i + 1, c: 1 });
      if (ws4[ref]) ws4[ref].z = IDR;
    });
    ws4["!cols"] = [{ wch: 25 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws4, "Expenses");

    XLSX.writeFile(wb, filename);
  }

  const barSize = chartData.length > 20 ? 5 : 12;
  const tickInterval =
    chartData.length > 20 ? Math.floor(chartData.length / 10) : 0;

  return (
    <AppLayout title="Reports">
      <div className="space-y-4 sm:space-y-6">
        {/* ── Filter + download ── */}
        <Card>
          <CardBody className="py-3 px-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#7C6352] font-medium">
                Periode:
              </span>
              {PRESETS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setPreset(key)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    preset === key
                      ? "bg-[#A05035] text-white"
                      : "bg-[#EDE4CF] text-[#7C6352] hover:bg-[#D9CCAF]",
                  )}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={downloadXLSX}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#737B4C] text-white hover:bg-[#5C6B38] transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download </span>Excel
              </button>
            </div>

            {preset === "custom" && (
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-[#E5DACA]">
                <span className="text-xs text-[#7C6352]">Dari</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-8 rounded-lg border border-[#D9CCAF] bg-[#FBF8F2] px-2 text-xs text-[#2C1810] focus:outline-none focus:ring-2 focus:ring-[#A05035]"
                />
                <span className="text-xs text-[#7C6352]">hingga</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-8 rounded-lg border border-[#D9CCAF] bg-[#FBF8F2] px-2 text-xs text-[#2C1810] focus:outline-none focus:ring-2 focus:ring-[#A05035]"
                />
                {customFrom && customTo && (
                  <span className="text-xs text-[#B88D6A]">
                    {differenceInDays(
                      new Date(customTo),
                      new Date(customFrom),
                    ) + 1}{" "}
                    hari
                  </span>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        {/* ── KPI ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Total Revenue"
            value={formatCurrency(stats.total_revenue)}
            icon={DollarSign}
            accent="dune"
            sub={`${stats.sales_count} transaksi`}
          />
          <StatCard
            label="Gross Profit"
            value={formatCurrency(stats.gross_profit)}
            icon={TrendingUp}
            accent="verde"
            sub={`Margin ${formatNumber(stats.gross_margin, 1)}%`}
          />
          <StatCard
            label="Total Expenses"
            value={formatCurrency(stats.total_expenses)}
            icon={Receipt}
            accent="clay"
            sub={`${filteredExpenses.length} entri`}
          />
          <StatCard
            label="Net Profit"
            value={formatCurrency(stats.net_profit)}
            icon={stats.net_profit >= 0 ? TrendingUp : TrendingDown}
            accent={stats.net_profit >= 0 ? "verde" : "clay"}
            sub={`Margin ${formatNumber(stats.net_margin, 1)}%`}
          />
        </div>

        {/* ── P&L Breakdown ── */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[#2C1810]">
              P&L Breakdown
            </h2>
          </CardHeader>
          <CardBody className="px-4 sm:px-6 py-4 space-y-1">
            {/* Revenue */}
            <div className="flex justify-between items-baseline py-1.5">
              <span className="text-sm font-semibold text-[#2C1810]">
                Revenue
              </span>
              <span className="text-sm font-bold text-[#2C1810] tabular-nums">
                {formatCurrency(stats.total_revenue)}
              </span>
            </div>
            {/* HPP */}
            <div className="flex justify-between items-baseline py-1 pb-3">
              <span className="text-xs text-[#B88D6A]">− HPP (COGS)</span>
              <span className="text-xs text-[#B88D6A] tabular-nums">
                ({formatCurrency(stats.total_hpp)})
              </span>
            </div>
            {/* Gross Profit pill */}
            <div className="flex justify-between items-baseline rounded-xl bg-[#737B4C]/10 px-4 py-3">
              <span className="text-sm font-bold text-[#5C6B38]">
                Gross Profit
                <span className="ml-2 text-xs font-normal text-[#737B4C]/70">
                  {formatNumber(stats.gross_margin, 1)}%
                </span>
              </span>
              <span className="text-sm font-bold text-[#5C6B38] tabular-nums">
                {formatCurrency(stats.gross_profit)}
              </span>
            </div>
            {/* Expenses breakdown */}
            {expByCategory.length > 0 && (
              <div className="pt-3 pb-1 space-y-1">
                <div className="flex justify-between items-baseline pb-1">
                  <span className="text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                    − Operational Expenses
                  </span>
                  <span className="text-xs font-medium text-[#7C6352] tabular-nums">
                    ({formatCurrency(stats.total_expenses)})
                  </span>
                </div>
                {expByCategory.map((cat) => (
                  <div
                    key={cat.name}
                    className="flex justify-between items-baseline pl-3"
                  >
                    <span className="text-xs text-[#B88D6A]">· {cat.name}</span>
                    <span className="text-xs text-[#B88D6A] tabular-nums">
                      {formatCurrency(cat.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {/* Net Profit pill */}
            <div
              className={`flex justify-between items-baseline rounded-xl px-4 py-3 mt-2 ${
                stats.net_profit >= 0 ? "bg-[#1B4332]" : "bg-red-700"
              }`}
            >
              <span className="text-sm font-bold text-white">
                Net Profit
                <span className="ml-2 text-xs font-normal text-white/60">
                  {formatNumber(stats.net_margin, 1)}%
                </span>
              </span>
              <span className="text-sm font-bold text-white tabular-nums">
                {formatCurrency(stats.net_profit)}
              </span>
            </div>
          </CardBody>
        </Card>

        {/* ── Chart ── */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[#2C1810]">
              {chartTitle}
            </h2>
          </CardHeader>
          <CardBody>
            {isLoading ? (
              <div className="h-[220px] flex items-center justify-center text-sm text-[#B88D6A]">
                Loading...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={chartData}
                  margin={{ top: 4, right: 4, left: -8, bottom: 0 }}
                  barGap={2}
                  barSize={barSize}
                >
                  <defs>
                    <linearGradient
                      id="gradRevenue"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#A05035" stopOpacity={1} />
                      <stop
                        offset="100%"
                        stopColor="#C0714F"
                        stopOpacity={0.75}
                      />
                    </linearGradient>
                    <linearGradient id="gradGross" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#737B4C" stopOpacity={1} />
                      <stop
                        offset="100%"
                        stopColor="#8E9960"
                        stopOpacity={0.75}
                      />
                    </linearGradient>
                    <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1B4332" stopOpacity={1} />
                      <stop
                        offset="100%"
                        stopColor="#3B7A57"
                        stopOpacity={0.75}
                      />
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
                    interval={tickInterval}
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
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: "#E9DFC6", opacity: 0.5 }}
                  />
                  <Bar
                    dataKey="revenue"
                    fill="url(#gradRevenue)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="grossProfit"
                    fill="url(#gradGross)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="netProfit"
                    fill="url(#gradNet)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="flex items-center gap-5 mt-3 justify-center flex-wrap">
              <span className="flex items-center gap-1.5 text-xs text-[#7C6352]">
                <span className="w-3 h-3 rounded-sm bg-[#A05035] inline-block" />
                Revenue
              </span>
              <span className="flex items-center gap-1.5 text-xs text-[#7C6352]">
                <span className="w-3 h-3 rounded-sm bg-[#737B4C] inline-block" />
                Gross Profit
              </span>
              <span className="flex items-center gap-1.5 text-xs text-[#7C6352]">
                <span className="w-3 h-3 rounded-sm bg-[#1B4332] inline-block" />
                Net Profit
              </span>
            </div>
          </CardBody>
        </Card>

        {/* ── Top Products ── */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[#2C1810]">
              Top Products by Profit
            </h2>
          </CardHeader>
          <CardBody className="p-0">
            {recipeProfit.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#B88D6A]">
                Tidak ada data untuk periode ini
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E5DACA]">
                      <th className="text-left px-4 sm:px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                        Product
                      </th>
                      <th className="text-right px-3 sm:px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                        HPP
                      </th>
                      <th className="text-right px-3 sm:px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                        Revenue
                      </th>
                      <th className="text-right px-4 sm:px-6 py-3 text-xs font-medium text-[#7C6352] uppercase tracking-wide">
                        Gross Profit
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
                          className={`px-4 sm:px-6 py-3 text-right tabular-nums font-semibold text-xs sm:text-sm whitespace-nowrap ${
                            r.profit >= 0 ? "text-[#737B4C]" : "text-[#C0392B]"
                          }`}
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
