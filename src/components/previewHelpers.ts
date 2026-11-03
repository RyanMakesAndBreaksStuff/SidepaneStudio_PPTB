import { normalizeConfigWidth } from '../services/configGuards';
import { MAX_CONFIG_WIDTH, MIN_CONFIG_WIDTH } from '../types/PaneDefinitionConfig';

export interface ComboItem {
  logicalName: string;
  displayName: string;
  detail?: string;
  isCustomEntity?: boolean;
}

export interface FilteredEntry<T extends ComboItem = ComboItem> {
  table: T;
}

export function filterTables<T extends ComboItem>(tables: T[], query: string): FilteredEntry<T>[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return tables.map(t => ({ table: t }));
  }
  const out: FilteredEntry<T>[] = [];
  for (const t of tables) {
    const inDisplay = t.displayName.toLowerCase().includes(q);
    const inLogical = t.logicalName.toLowerCase().includes(q);
    if (!inDisplay && !inLogical) continue;
    out.push({ table: t });
  }
  out.sort((a, b) => {
    const ap = a.table.displayName.toLowerCase().startsWith(q) || a.table.logicalName.toLowerCase().startsWith(q);
    const bp = b.table.displayName.toLowerCase().startsWith(q) || b.table.logicalName.toLowerCase().startsWith(q);
    if (ap !== bp) return ap ? -1 : 1;
    return a.table.displayName.localeCompare(b.table.displayName);
  });
  return out;
}

const MIN_PREVIEW_WIDTH = 160;
const MAX_PREVIEW_WIDTH = 300;

/** Inline preview width: the 300..1200 config range scaled linearly onto 160..300 px. */
export function getPreviewPaneWidth(configWidth: number): number {
  const clamped = normalizeConfigWidth(configWidth);
  return Math.round(
    MIN_PREVIEW_WIDTH +
    ((clamped - MIN_CONFIG_WIDTH) / (MAX_CONFIG_WIDTH - MIN_CONFIG_WIDTH)) *
      (MAX_PREVIEW_WIDTH - MIN_PREVIEW_WIDTH)
  );
}

const SAFE_RELATIVE_IMAGE_PATH = /^[A-Za-z0-9_\-./]+$/;

export function isSafeRelativeImagePath(value: string): boolean {
  if (!SAFE_RELATIVE_IMAGE_PATH.test(value) || value.includes(':') || value.startsWith('/')) return false;
  return !value.split('/').includes('..');
}

export function getSafePreviewImageSrc(imageSrc: string): string | null {
  const trimmed = imageSrc.trim();
  return isSafeRelativeImagePath(trimmed) && !trimmed.startsWith('//') ? trimmed : null;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
