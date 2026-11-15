/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Legacy Supabase anon key name, supported as a fallback. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** true for Pi Sandbox/Testnet app registration; false for production/Mainnet. */
  readonly VITE_PI_SANDBOX?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
