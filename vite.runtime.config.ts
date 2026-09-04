import { defineConfig } from 'vite';

/**
 * Builds src/runtime/index.ts into a single self-contained IIFE suitable for upload
 * as the Dataverse JavaScript web resource named by RUNTIME_WEB_RESOURCE_NAME
 * (src/constants.ts). Deliberately separate from vite.config.ts, which builds the studio app.
 */
export default defineConfig({
  build: {
    outDir: 'dist-runtime',
    emptyOutDir: true,
    target: 'es2017',
    lib: {
      entry: 'src/runtime/index.ts',
      name: 'SidePaneHelper',
      formats: ['iife'],
      fileName: () => 'sidepane.runtime.js',
    },
    rollupOptions: {
      output: { extend: true },
    },
  },
});
