/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Build-time injected version string. Set in CI from the workflow-computed
// release tag (v{date}-{shortSha}); falls back to `git describe` locally,
// then to 'dev' if neither is available. See vite.config.ts.
interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}