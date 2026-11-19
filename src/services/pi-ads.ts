import { initializePiSdk } from "./pi";

/**
 * Pi Ad Network integration for interstitial advertisements.
 *
 * - Only the official Pi Browser native SDK may display an ad.
 * - Ads appear only at a user-initiated quiz transition after three
 *   completed quizzes, never while answering or viewing a result.
 * - At least 15 minutes separate two displayed ads on this device.
 * - If unavailable or unsupported, normal quiz navigation continues.
 * - No XP or leaderboard points are granted for watching an ad.
 *
 * Loading banner ads are controlled in Pi Developer Portal, not Pi SDK.
 */

const COMPLETIONS_KEY = "pi-brain-ad-completions-v1";
const LAST_SHOWN_KEY = "pi-brain-ad-last-shown-v1";
const REQUIRED_COMPLETIONS = 3;
const COOLDOWN_MS = 15 * 60 * 1000;

// Prevent duplicate counting if a user double-taps the Finish button.
const countedSessions = new Set<string>();
let adInProgress = false;

type PiNativeAds = {
  nativeFeaturesList?: () => Promise<string[]>;
  Ads?: {
    isAdReady: (type: "interstitial") => Promise<{ ready: boolean }>;
    showAd: (type: "interstitial") => Promise<{ result: string }>;
  };
};

function readStoredCount(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    const n = Number(raw);
    return raw !== null && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function storeCount(key: string, value: number): void {
  try { localStorage.setItem(key, String(value)); }
  catch { /* Storage can be disabled; ads are optional. */ }
}

// A slow native readiness check must not indefinitely block quiz navigation.
async function readinessWithin<T>(promise: Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), 3000);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function recordCompletedQuizForAds(serverSessionId: string | null): void {
  // Local/demo sessions do not count toward advertising frequency.
  if (!serverSessionId || countedSessions.has(serverSessionId)) return;
  countedSessions.add(serverSessionId);
  // Cap counter to prevent runaway values when ads are unavailable.
  storeCount(COMPLETIONS_KEY, Math.min(30, readStoredCount(COMPLETIONS_KEY) + 1));
}

/** Call from the user's explicit request to start another quiz. */
export async function showInterstitialAtQuizBreak(): Promise<void> {
  if (adInProgress || readStoredCount(COMPLETIONS_KEY) < REQUIRED_COMPLETIONS) return;
  const lastShown = readStoredCount(LAST_SHOWN_KEY);
  if (Date.now() - lastShown < COOLDOWN_MS) return;
  if (typeof window === "undefined") return;

  // Initialize once through the existing authentication SDK integration.
  // Ad serving/monetization still requires Pi Developer Portal approval.
  adInProgress = true;
  try {
    if (!(await initializePiSdk())) return;
    const sdk = window.Pi as unknown as PiNativeAds | undefined;
    if (!sdk?.nativeFeaturesList || !sdk.Ads) return;
    const features = await readinessWithin(sdk.nativeFeaturesList());
    if (!features?.includes("ad_network")) return;

    // Pi Browser normally preloads ads. Don't delay quiz navigation to load
    // one over the network when it is not immediately available.
    const ready = await readinessWithin(sdk.Ads.isAdReady("interstitial"));
    if (!ready?.ready) return;

    const result = await sdk.Ads.showAd("interstitial");
    if (result.result === "AD_CLOSED") {
      storeCount(COMPLETIONS_KEY, Math.max(0, readStoredCount(COMPLETIONS_KEY) - REQUIRED_COMPLETIONS));
      storeCount(LAST_SHOWN_KEY, Date.now());
    }
  } catch {
    // Ad SDK failure must never interrupt a quiz or alter quiz scoring.
  } finally {
    adInProgress = false;
  }
}
