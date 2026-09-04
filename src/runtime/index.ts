/**
 * Build entry for the SidePaneHelper web resource.
 * `npm run build:runtime` bundles this as an IIFE to dist-runtime/sidepane.runtime.js,
 * which is uploaded as the web resource named by RUNTIME_WEB_RESOURCE_NAME.
 */
import { open } from './sidePaneHelper';

const SidePaneHelper = { open };

(globalThis as unknown as { SidePaneHelper?: typeof SidePaneHelper }).SidePaneHelper = SidePaneHelper;

export { SidePaneHelper };
