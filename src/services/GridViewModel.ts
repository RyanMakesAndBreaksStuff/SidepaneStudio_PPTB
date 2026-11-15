import type { MetadataService, ViewInfo } from './MetadataService';
import { isValidLogicalName } from './odataGuards';
import type { PaneDefinitionConfig } from '../types/PaneDefinitionConfig';

export interface GridColumn {
  key: string;
  label: string;
  width: number;
  valueKeys: string[];
  primary: boolean;
}

function parseLayout(source: string): Document {
  const doc = new DOMParser().parseFromString(source, 'text/xml');
  if (doc.doctype || doc.querySelector('parsererror') || doc.documentElement.tagName !== 'grid') {
    throw new Error('The selected view has an invalid grid layout.');
  }
  return doc;
}

/** A view's FetchXML parsed once and validated against the preview entity. */
export interface GridFetch {
  doc: Document;
  entity: Element;
}

const entitiesOf = (fetch: Element) => Array.from(fetch.children).filter(child => child.tagName === 'entity');

export function parseGridFetch(source: string, entityName: string): GridFetch {
  const doc = new DOMParser().parseFromString(source, 'text/xml');
  const fetch = doc.documentElement;
  const entities = entitiesOf(fetch);
  if (doc.doctype || doc.querySelector('parsererror') || fetch.tagName !== 'fetch' ||
      entities.length !== 1 || entities[0].getAttribute('name') !== entityName) {
    throw new Error('This view does not contain valid FetchXML for the preview entity.');
  }
  return { doc, entity: entities[0] };
}

/** Serialise a copy of the parsed FetchXML limited to 10 rows; the parsed document is left untouched. */
export function capGridFetchXml(source: GridFetch, lookupColumn = ''): string {
  const doc = source.doc.cloneNode(true) as Document;
  const fetch = doc.documentElement;
  const entity = entitiesOf(fetch)[0];
  const existing = fetch.getAttribute('top');
  if (existing !== null && (!/^\d+$/.test(existing) || Number(existing) < 1)) {
    throw new Error('This view has an invalid FetchXML row limit.');
  }
  // RelatedRecord previews read the lookup value even when the view does not display it.
  if (lookupColumn && !Array.from(entity.children).some(child => child.tagName === 'all-attributes' ||
      (child.tagName === 'attribute' && child.getAttribute('name') === lookupColumn))) {
    const column = doc.createElement('attribute');
    column.setAttribute('name', lookupColumn);
    entity.appendChild(column);
  }
  for (const attribute of ['page', 'count', 'paging-cookie', 'returntotalrecordcount']) fetch.removeAttribute(attribute);
  fetch.setAttribute('top', String(Math.min(10, existing === null ? 10 : Number(existing))));
  return new XMLSerializer().serializeToString(doc);
}

export async function resolveGridColumns(
  view: ViewInfo,
  entityName: string,
  metadata: Pick<MetadataService, 'listAttributeLabels'>,
  parsedFetch?: GridFetch
): Promise<GridColumn[]> {
  const layout = parseLayout(view.layoutXml);
  const { entity } = parsedFetch ?? parseGridFetch(view.fetchXml, entityName);
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

/** Lookup column a lookup-source preview simulates; '' for every other source. */
export function getRelatedLookup(config: PaneDefinitionConfig): string {
  return config.context.source.kind === 'lookup' ? config.context.source.attribute.trim() : '';
}

/** The record a RelatedRecord pane opens, as a preview row's lookup value supplies it. */
export interface PreviewRecord {
  id: string;
  name: string;
  entityName?: string;
}

const LOOKUP_LOGICAL_NAME = '@Microsoft.Dynamics.CRM.lookuplogicalname';

export function relatedRecordOf(row: Record<string, unknown>, lookupColumn: string): PreviewRecord | null {
  const key = `_${lookupColumn}_value`;
  const id = row[key];
  if (typeof id !== 'string' || !id) return null;
  const name = row[`${key}${FORMATTED}`];
  const entityName = row[`${key}${LOOKUP_LOGICAL_NAME}`];
  return { id, name: typeof name === 'string' ? name : '',
    ...(typeof entityName === 'string' && isValidLogicalName(entityName) ? { entityName } : {}) };
}

export type RelatedRecordResolution =
  | { status: 'empty' }
  | { status: 'resolved'; record: PreviewRecord }
  | { status: 'unresolved'; reason: 'table-unknown' | 'table-not-allowed' };

/** Resolve a populated lookup using its row annotation or one confirmed metadata target. */
export function resolveRelatedRecord(
  row: Record<string, unknown>,
  lookupColumn: string,
  targets?: readonly string[] | null
): RelatedRecordResolution {
  const record = relatedRecordOf(row, lookupColumn);
  if (!record) return { status: 'empty' };

  const rawAnnotation = row[`_${lookupColumn}_value${LOOKUP_LOGICAL_NAME}`];
  if (rawAnnotation !== undefined && rawAnnotation !== null &&
      (typeof rawAnnotation !== 'string' || !isValidLogicalName(rawAnnotation))) {
    return { status: 'unresolved', reason: 'table-not-allowed' };
  }

  const knownTargets = [...new Set((targets ?? []).filter(isValidLogicalName))];
  if (record.entityName) {
    if (knownTargets.length > 0 && !knownTargets.includes(record.entityName)) {
      return { status: 'unresolved', reason: 'table-not-allowed' };
    }
    return { status: 'resolved', record };
  }
  if (knownTargets.length === 1) {
    return { status: 'resolved', record: { ...record, entityName: knownTargets[0] } };
  }
  return { status: 'unresolved', reason: 'table-unknown' };
}

/** One source record whose lookup is set: the Form preview's RelatedRecord sample. */
export function buildRelatedSampleFetchXml(entityName: string, lookupColumn: string): string {
  // Names are interpolated into XML, so both must be plain logical names.
  if (!isValidLogicalName(entityName) || !isValidLogicalName(lookupColumn)) {
    throw new Error('Select a valid source table and lookup column.');
  }
  return `<fetch top="1"><entity name="${entityName}"><attribute name="${lookupColumn}"/>` +
    `<filter><condition attribute="${lookupColumn}" operator="not-null"/></filter></entity></fetch>`;
}
