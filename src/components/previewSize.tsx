import * as React from 'react';
import { createContext, useContext, useMemo } from 'react';

export type PreviewSizeMode = 'compact' | 'regular' | 'wide';

export interface PreviewSize {
  /** Observed width of the PreviewPanel root, in CSS px. 0 until first measurement. */
  width: number;
  /** Coarse layout bucket — children should branch on this, not on raw px. */
  mode: PreviewSizeMode;
}

// Breakpoints: tuned so that the simulated MDA window can show 1 / 2 / 3
// columns of form content without overflow given a 12px PreviewPanel padding.
const COMPACT_MAX = 560;
const REGULAR_MAX = 860;

export function classifyPreviewWidth(width: number): PreviewSizeMode {
  if (width <= 0) return 'wide';            // pre-measurement: assume wide, downgrade on first observe
  if (width < COMPACT_MAX) return 'compact';
  if (width < REGULAR_MAX) return 'regular';
  return 'wide';
}

const PreviewSizeContext = createContext<PreviewSize>({ width: 0, mode: 'wide' });

export function PreviewSizeProvider({
  width,
  children,
}: {
  width: number;
  children: React.ReactNode;
}): React.ReactElement {
  const value = useMemo<PreviewSize>(
    () => ({ width, mode: classifyPreviewWidth(width) }),
    [width]
  );
  return <PreviewSizeContext.Provider value={value}>{children}</PreviewSizeContext.Provider>;
}

export function usePreviewSize(): PreviewSize {
  return useContext(PreviewSizeContext);
}
