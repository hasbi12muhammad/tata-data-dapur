import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  accent?: "blue" | "green" | "red" | "amber";
  trend?: number;
}

const accents = {
  blue: "bg-blue-50 text-blue-600",
  green: "bg-emerald-50 text-emerald-600",
  red: "bg-red-50 text-red-600",
  amber: "bg-amber-50 text-amber-600",
};

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "blue",
  trend,
}: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex gap-4 items-start">
      <div className={cn("p-2.5 rounded-xl flex-shrink-0", accents[accent])}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          {label}
        </p>
        <p className="mt-1 text-xl font-bold text-slate-900 font-mono tabular-nums truncate">
          {value}
        </p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        {trend !== undefined && (
          <p
            className={cn(
              "text-xs font-medium mt-1",
              trend >= 0 ? "text-emerald-600" : "text-red-600",
            )}
          >
            {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%
          </p>
        )}
      </div>
    </div>
  );
}
