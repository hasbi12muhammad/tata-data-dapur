/**
 * Entitlements — resolves which features are active for THIS deployment.
 *
 * Per-client config lives entirely in env vars so the codebase stays identical
 * across every client (lets a base-app push auto-update all clients):
 *
 *   NEXT_PUBLIC_ENABLED_FEATURES   comma list of add-on features to switch ON
 *                                  e.g. "kasir"
 *   NEXT_PUBLIC_DISABLED_FEATURES  comma list of core features to switch OFF
 *                                  e.g. "recipes"   (replaces the old hardcoded
 *                                                     RECIPE_HIDDEN_UID hack)
 *
 * Both vars are NEXT_PUBLIC_ so the same logic runs in middleware, server
 * components and client components.
 */

import {
  ALL_FEATURE_IDS,
  FEATURES,
  isFeatureId,
  type FeatureDef,
  type FeatureId,
} from "./registry";

function parseFeatureList(raw: string | undefined): Set<FeatureId> {
  const out = new Set<FeatureId>();
  if (!raw) return out;
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (id && isFeatureId(id)) out.add(id);
  }
  return out;
}

/** Cached so we don't re-parse env on every call within a request. */
let cache: Set<FeatureId> | null = null;

function computeEnabled(): Set<FeatureId> {
  const enabledAddons = parseFeatureList(
    process.env.NEXT_PUBLIC_ENABLED_FEATURES,
  );
  const disabledCore = parseFeatureList(
    process.env.NEXT_PUBLIC_DISABLED_FEATURES,
  );

  const result = new Set<FeatureId>();
  for (const id of ALL_FEATURE_IDS) {
    const f = FEATURES[id];
    const on = f.core ? !disabledCore.has(id) : enabledAddons.has(id);
    if (on) result.add(id);
  }
  return result;
}

export function getEnabledFeatureIds(): Set<FeatureId> {
  if (!cache) cache = computeEnabled();
  return cache;
}

export function isFeatureEnabled(id: FeatureId): boolean {
  return getEnabledFeatureIds().has(id);
}

/** Returns the feature that owns a given pathname, if any. */
export function getFeatureForPath(pathname: string): FeatureDef | undefined {
  for (const id of ALL_FEATURE_IDS) {
    const f = FEATURES[id];
    for (const route of f.routes) {
      if (pathname === route || pathname.startsWith(route + "/")) return f;
    }
  }
  return undefined;
}

/**
 * Whether a request path is allowed for this deployment. Paths that don't map
 * to any feature (e.g. /login, /settings) are always allowed — only known
 * feature routes are gated.
 */
export function isPathAllowed(pathname: string): boolean {
  const feature = getFeatureForPath(pathname);
  if (!feature) return true;
  return isFeatureEnabled(feature.id);
}
