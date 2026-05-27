/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_STRIPE_PAYMENT_LINK: string;
  readonly VITE_STRIPE_WEBHOOK_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Allow `import styles from './x.css?inline'`.
declare module '*.css?inline' {
  const css: string;
  export default css;
}
