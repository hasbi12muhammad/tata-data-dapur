/**
 * Tenant config — per-deployment identity & branding, sourced from env vars.
 * One client = one deployment = one set of these vars. Defaults keep the base
 * app working unchanged when no tenant env is provided.
 */

import { getEnabledFeatureIds } from "@/lib/features/entitlements";
import type { FeatureId } from "@/lib/features/registry";

export interface TenantConfig {
  /** Display name of the client's business (shown in sidebar, titles). */
  name: string;
  /** Billing plan label (free-form, e.g. "base", "kasir", "premium"). */
  plan: string;
  /** Feature ids active for this deployment. */
  features: FeatureId[];
}

export function getTenantConfig(): TenantConfig {
  return {
    name: process.env.NEXT_PUBLIC_TENANT_NAME?.trim() || "Tata Data Dapur",
    plan: process.env.NEXT_PUBLIC_TENANT_PLAN?.trim() || "base",
    features: [...getEnabledFeatureIds()],
  };
}
