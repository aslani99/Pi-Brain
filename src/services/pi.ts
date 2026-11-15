import { isBackendConfigured, verifyPiOnBackend, type PiVerifiedProfile } from "./backend";

type PiAuthResult = {
  accessToken: string;
  user: { uid: string; username: string };
};

type PiSdk = {
  init: (options: { version: string; sandbox: boolean }) => void;
  authenticate: (
    scopes: string[],
    onIncompletePaymentFound?: (payment: unknown) => void,
  ) => Promise<PiAuthResult>;
};

declare global {
  interface Window {
    Pi?: PiSdk;
  }
}

let initialized = false;

export function initializePiSdk(): boolean {
  if (typeof window === "undefined" || !window.Pi) return false;
  if (!initialized) {
    const sandbox = import.meta.env.VITE_PI_SANDBOX !== "false";
    try {
      window.Pi.init({ version: "2.0", sandbox });
      initialized = true;
    } catch {
      // Keep the regular web preview usable if the Pi bridge is not authorized here.
      return false;
    }
  }
  return true;
}

export function isPiSdkAvailable(): boolean {
  return typeof window !== "undefined" && Boolean(window.Pi);
}

export async function authenticatePiUser(locale: string): Promise<{
  accessToken: string;
  profile: PiVerifiedProfile;
}> {
  if (!isBackendConfigured()) {
    throw new Error("First connect the Supabase project using .env.local.");
  }
  if (!initializePiSdk() || !window.Pi) {
    throw new Error("Pi SDK is not available. Open the app in Pi Browser or Pi Sandbox.");
  }

  // Request only the username scope. Payments and wallet access are not needed yet.
  const auth = await window.Pi.authenticate(["username"], () => undefined);
  if (!auth?.accessToken) throw new Error("Pi did not return an access token.");

  // Never trust the user object returned by the browser SDK for identity.
  // The Edge Function validates the token against the Pi Platform API /me endpoint.
  const verified = await verifyPiOnBackend(auth.accessToken, locale);
  return { accessToken: auth.accessToken, profile: verified.profile };
}
