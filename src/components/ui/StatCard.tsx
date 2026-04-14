import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  accent?: "dune" | "verde" | "red" | "clay";
  trend?: number;
}

// Warm earthy accents
const accents = {
  dune: "bg-[#A05035]/10 text-[#A05035]", // terracotta — revenue
  verde: "bg-[#737B4C]/10 text-[#737B4C]", // olive — profit
  clay: "bg-[#B88D6A]/15 text-[#7C563D]", // clay — HPP
  red: "bg-[#C0392B]/10 text-[#C0392B]", // destructive
};

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "dune",
  trend,
}: StatCardProps) {
  return (
    <div className="bg-[#FBF8F2] rounded-xl border border-[#D9CCAF] shadow-sm p-5 flex gap-4 items-start">
      <div className={cn("p-2.5 rounded-xl flex-shrink-0", accents[accent])}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[#7C6352] uppercase tracking-wide">
          {label}
        </p>
        <p className="mt-1 text-xl font-bold text-[#2C1810] font-mono tabular-nums truncate">
          {value}
        </p>
        {sub && <p className="text-xs text-[#7C6352] mt-0.5">{sub}</p>}
        {trend !== undefined && (
          <p
            className={cn(
              "text-xs font-medium mt-1",
              trend >= 0 ? "text-[#737B4C]" : "text-[#C0392B]",
            )}
          >
            {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%
          </p>
        )}
      </div>
    </div>
  );
}
