import { TableInfo } from '../services/MetadataService';

export interface FilteredEntry {
  table: TableInfo;
  matchedOn: 'display' | 'logical' | 'both';
}

export function filterTables(tables: TableInfo[], query: string): FilteredEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return tables.map(t => ({ table: t, matchedOn: 'display' as const }));
  }
  const out: FilteredEntry[] = [];
  for (const t of tables) {
    const inDisplay = t.displayName.toLowerCase().includes(q);
    const inLogical = t.logicalName.toLowerCase().includes(q);
    if (!inDisplay && !inLogical) continue;
    out.push({
      table: t,
      matchedOn: inDisplay && inLogical ? 'both' : inDisplay ? 'display' : 'logical',
    });
  }
  out.sort((a, b) => {
    const ap = a.table.displayName.toLowerCase().startsWith(q) || a.table.logicalName.toLowerCase().startsWith(q);
    const bp = b.table.displayName.toLowerCase().startsWith(q) || b.table.logicalName.toLowerCase().startsWith(q);
    if (ap !== bp) return ap ? -1 : 1;
    return a.table.displayName.localeCompare(b.table.displayName);
  });
  return out;
}

export const MIN_CONFIG_WIDTH = 300;
const MID_CONFIG_WIDTH = 1000;
export const MAX_CONFIG_WIDTH = 1200;
const MIN_PREVIEW_WIDTH = 120;
const MID_PREVIEW_WIDTH = 270;
const MAX_PREVIEW_WIDTH = 300;

export function getPreviewPaneWidth(configWidth: number): number {
  const clamped = Math.min(MAX_CONFIG_WIDTH, Math.max(MIN_CONFIG_WIDTH, configWidth));
  if (clamped <= MID_CONFIG_WIDTH) {
    return Math.round(
      MIN_PREVIEW_WIDTH +
      ((clamped - MIN_CONFIG_WIDTH) / (MID_CONFIG_WIDTH - MIN_CONFIG_WIDTH)) *
        (MID_PREVIEW_WIDTH - MIN_PREVIEW_WIDTH)
    );
  }

  return Math.round(
    MID_PREVIEW_WIDTH +
    ((clamped - MID_CONFIG_WIDTH) / (MAX_CONFIG_WIDTH - MID_CONFIG_WIDTH)) *
      (MAX_PREVIEW_WIDTH - MID_PREVIEW_WIDTH)
  );
}

export function getSafePreviewImageSrc(imageSrc: string): string | null {
  const trimmed = imageSrc.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('http:') ||
    lower.startsWith('https:') ||
    lower.startsWith('//') ||
    lower.startsWith('data:') ||
    lower.startsWith('javascript:')
  ) {
    return null;
  }

  return trimmed;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
