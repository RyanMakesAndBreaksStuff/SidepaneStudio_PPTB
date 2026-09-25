import type { MetadataService, ViewInfo } from './MetadataService';
import type { PaneDefinitionConfig } from '../types/PaneDefinitionConfig';

export interface GridColumn {
  key: string;
  label: string;
  width: number;
  valueKeys: string[];
  primary: boolean;
}

function parseXml(source: string, root: string): Document {
  const doc = new DOMParser().parseFromString(source, 'text/xml');
  if (doc.doctype || doc.querySelector('parsererror') || doc.documentElement.tagName !== root) {
    throw new Error('The selected view has an invalid grid layout or query.');
  }
  return doc;
}

export async function resolveGridColumns(
  view: ViewInfo,
  entityName: string,
  metadata: Pick<MetadataService, 'listAttributeLabels'>
): Promise<GridColumn[]> {
  const layout = parseXml(view.layoutXml, 'grid');
  const fetch = parseXml(view.fetchXml, 'fetch');
  const entities = Array.from(fetch.documentElement.children).filter(e => e.tagName === 'entity');
  const entity = entities[0];
  if (entities.length !== 1 || entity.getAttribute('name') !== entityName) {
    throw new Error('The selected view does not match the preview entity.');
  }
  const rows = Array.from(layout.documentElement.children).filter(e => e.tagName === 'row');
  if (rows.length !== 1) throw new Error('The selected view has no supported grid row layout.');
  const cells = Array.from(rows[0].children).filter(e => e.tagName === 'cell');
  if (!cells.length) throw new Error('The selected view has no display columns.');
  const bindings = cells.map(cell => {
    const key = cell.getAttribute('name') ?? '';
    const candidates: { table: string; attribute: string; valueKeys: string[] }[] = [];
    for (const owner of [entity, ...Array.from(entity.querySelectorAll('link-entity'))]) {
      const root = owner === entity;
      const alias = owner.getAttribute('alias');
      const table = owner.getAttribute('name') ?? '';
      for (const attr of Array.from(owner.children).filter(e => e.tagName === 'attribute')) {
        const attribute = attr.getAttribute('name') ?? '';
        const explicit = attr.getAttribute('alias');
        const resultKey = explicit || (root ? attribute : alias ? `${alias}.${attribute}` : '');
        if (resultKey && resultKey === key) {
          candidates.push({ table, attribute, valueKeys: root && !explicit
            ? [attribute, `_${attribute}_value`] : [resultKey] });
        }
      }
      if (root && !key.includes('.') && Array.from(owner.children).some(e => e.tagName === 'all-attributes')) {
        if (!candidates.some(c => c.table === table && c.attribute === key)) {
          candidates.push({ table, attribute: key, valueKeys: [key, `_${key}_value`] });
        }
      }
    }
    if (candidates.length !== 1) throw new Error('A grid column cannot be resolved from the selected view.');
    const width = Number(cell.getAttribute('width'));
    return { key, ...candidates[0], width: Number.isFinite(width) && width > 0 ? width : 160,
      primary: key === layout.documentElement.getAttribute('jump') };
  });
  if (new Set(bindings.map(b => b.key)).size !== bindings.length) {
    throw new Error('The selected view contains duplicate grid columns.');
  }
  const tables = new Map(await Promise.all([...new Set(bindings.map(b => b.table))].map(async table =>
    [table, await metadata.listAttributeLabels(table)] as const)));
  return bindings.map(binding => {
    const label = tables.get(binding.table)?.find(a => a.LogicalName === binding.attribute)
      ?.DisplayName?.UserLocalizedLabel?.Label?.trim();
    if (!label) throw new Error('Display labels are unavailable for one or more view columns.');
    return { key: binding.key, label, width: binding.width, valueKeys: binding.valueKeys, primary: binding.primary };
  });
}

const FORMATTED = '@OData.Community.Display.V1.FormattedValue';
export function gridCellText(row: Record<string, unknown>, column: GridColumn): string {
  const key = column.valueKeys.find(k => row[`${k}${FORMATTED}`] !== undefined)
    ?? column.valueKeys.find(k => row[k] !== undefined);
  if (!key) return '';
  const value = row[`${key}${FORMATTED}`] ?? row[key];
  if (value === null || value === undefined) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/** RelatedRecord lookup column the preview simulates; '' in every other context mode. */
export function getRelatedLookup(config: PaneDefinitionConfig): string {
  return config.context.mode === 'RelatedRecord' ? config.context.lookupAttribute.trim() : '';
}

/** The record a RelatedRecord pane opens, as a preview row's lookup value supplies it. */
export interface PreviewRecord {
  id: string;
  name: string;
}

export function relatedRecordOf(row: Record<string, unknown>, lookupAttribute: string): PreviewRecord | null {
  const key = `_${lookupAttribute}_value`;
  const id = row[key];
  if (typeof id !== 'string' || !id) return null;
  const name = row[`${key}${FORMATTED}`];
  return { id, name: typeof name === 'string' ? name : '' };
}
