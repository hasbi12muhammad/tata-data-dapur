/**
 * Feature registry — single source of truth for every module/feature that the
 * base app can ship. Each client deployment turns features on/off purely via
 * env vars (see `entitlements.ts`); the code is identical across all clients.
 *
 * - `core: true`  → ships in the base package, enabled by default. Can be
 *   switched OFF for a specific client via NEXT_PUBLIC_DISABLED_FEATURES.
 * - `core: false` → sold as an add-on package, disabled by default. Switched
 *   ON for a client via NEXT_PUBLIC_ENABLED_FEATURES.
 */

export type FeatureId =
  | "dashboard"
  | "items"
  | "purchases"
  | "expenses"
  | "recipes"
  | "produksi"
  | "sales"
  | "reports"
  | "kasir";

export interface FeatureDef {
  id: FeatureId;
  /** Human label (used in marketing / admin, not necessarily the nav label). */
  label: string;
  /** Route prefixes this feature owns. Used for middleware route gating. */
  routes: string[];
  /** Core features are part of the base package (enabled unless disabled). */
  core: boolean;
  /** Sellable package this feature belongs to (for billing & marketing). */
  package: string;
}

export const FEATURES: Record<FeatureId, FeatureDef> = {
  dashboard: {
    id: "dashboard",
    label: "Dashboard",
    routes: ["/dashboard"],
    core: true,
    package: "base",
  },
  items: {
    id: "items",
    label: "Bahan Baku",
    routes: ["/items"],
    core: true,
    package: "base",
  },
  purchases: {
    id: "purchases",
    label: "Pembelian",
    routes: ["/purchases"],
    core: true,
    package: "base",
  },
  expenses: {
    id: "expenses",
    label: "Pengeluaran",
    routes: ["/expenses"],
    core: true,
    package: "base",
  },
  recipes: {
    id: "recipes",
    label: "Produk",
    routes: ["/recipes"],
    core: true,
    package: "base",
  },
  produksi: {
    id: "produksi",
    label: "Produksi",
    routes: ["/produksi"],
    core: true,
    package: "base",
  },
  sales: {
    id: "sales",
    label: "Penjualan",
    routes: ["/sales"],
    core: true,
    package: "base",
  },
  reports: {
    id: "reports",
    label: "Laporan",
    routes: ["/reports"],
    core: true,
    package: "base",
  },

  // ── Add-on packages (disabled by default) ──────────────────────────────
  kasir: {
    id: "kasir",
    label: "Kasir / POS",
    routes: ["/kasir"],
    core: false,
    package: "kasir",
  },
};

export const ALL_FEATURE_IDS = Object.keys(FEATURES) as FeatureId[];

export function isFeatureId(value: string): value is FeatureId {
  return Object.prototype.hasOwnProperty.call(FEATURES, value);
}
