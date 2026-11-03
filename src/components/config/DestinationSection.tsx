import * as React from 'react';
import { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { theme } from '../../theme/tokens';
import type { LookupAttributeInfo } from '../../services/MetadataService';
import type { PaneDefinitionConfig, PageType, RecordSource, RecordSourceKind, TargetConfig } from '../../types/PaneDefinitionConfig';
import { RECORD_TARGETS } from '../../types/PaneDefinitionConfig';
import { allowedSources, allowedTargets, defaultSource, destinationTable, isCreating, resetTarget, sendsRecord } from '../../services/triggerCapabilities';
import { applyLookup } from '../../services/relatedRecordConfig';
import { normalizeGuid } from '../../services/odataGuards';
import type { ConfigurePanelProps } from '../ConfigurePanel';
import type { SectionSharedProps } from './TriggerSection';
import { ChoiceGroup } from '../ChoiceGroup';
import { Field } from '../Field';
import { Input } from '../Input';
import { TablePicker } from '../TablePicker';
import { useAccessibleTables } from '../useAccessibleTables';
import { DashboardPicker } from '../DashboardPicker';
import { LookupPicker } from '../LookupPicker';
import { FormSelector } from '../FormSelector';
import { ViewPicker } from '../ViewPicker';
import { JsonDataField } from '../JsonDataField';
import { Callout } from '../Callout';

export type DestinationSectionProps = SectionSharedProps & Pick<ConfigurePanelProps, 'formXmlService'>;

const FORM_DATA_EXAMPLE = `{
  "name": "Contoso",
  "description": "Opened from the side pane.",
  "donotemail": 1
}`;
const GENERATIVE_INPUTS_DOC = 'https://learn.microsoft.com/en-us/power-apps/maker/model-driven-apps/generative-pages#set-up-a-page-to-accept-input-parameters';

const PAGE_TYPE_OPTIONS = [
  { value: 'custom', label: 'Custom page', desc: 'A canvas app page in your solution' },
  { value: 'generative', label: 'Generative page', desc: 'A page the app agent built in the app designer' },
  { value: 'entityrecord', label: 'Table record', desc: 'Open a specific or context-driven record' },
  { value: 'entitylist', label: 'Table list', desc: 'Show a view of table records' },
  { value: 'webresource', label: 'Web resource', desc: 'Embed an HTML/JS web resource' },
  { value: 'dashboard', label: 'Dashboard', desc: 'System or personal dashboard' },
  { value: 'search', label: 'Search', desc: 'Global search results — not documented by navigateTo' },
];
const RECORD_MODE_OPTIONS = [
  { value: 'open', label: 'Open existing record', desc: 'Opens the record the trigger or source supplies' },
  { value: 'create', label: 'Create new record', desc: 'Opens a blank form; Form data pre-fills its columns' },
];
const SOURCE_OPTIONS: Record<RecordSourceKind, { value: string; label: string; desc: string }> = {
  host: { value: 'host', label: 'The record on this form', desc: 'The record on the triggering form' },
  selectedRow: { value: 'selectedRow', label: 'The selected row', desc: 'The first selected row' },
  clickedTag: { value: 'clickedTag', label: 'The clicked tag record', desc: "The clicked tag's id and table" },
  lookup: { value: 'lookup', label: 'A record in a lookup', desc: 'A record a lookup on the host table points to' },
  fixed: { value: 'fixed', label: 'A specific record', desc: 'A record named here by GUID' },
  none: { value: 'none', label: 'No record', desc: 'Open the pane without a record' },
};

type TargetFields<P extends TargetConfig['pageType']> = Partial<Omit<Extract<TargetConfig, { pageType: P }>, 'pageType'>>;
function patchTarget<P extends TargetConfig['pageType']>(
  prev: PaneDefinitionConfig, pageType: P, fields: TargetFields<P>,
): PaneDefinitionConfig {
  if (prev.target.pageType !== pageType) return prev;
  return { ...prev, target: { ...prev.target, ...fields } as TargetConfig };
}

type SourceFields<K extends RecordSourceKind> = Partial<Omit<Extract<RecordSource, { kind: K }>, 'kind'>>;
function patchSource<K extends RecordSourceKind>(
  prev: PaneDefinitionConfig, kind: K, fields: SourceFields<K>,
): PaneDefinitionConfig {
  if (prev.context.source.kind !== kind) return prev;
  return { ...prev, context: { ...prev.context, source: { ...prev.context.source, ...fields } as RecordSource } };
}

function openDocsLink(event: React.MouseEvent<HTMLAnchorElement>): void {
  const open = window.toolboxAPI?.utils?.openInConnectionBrowser;
  if (!open) return;
  event.preventDefault();
  void open(event.currentTarget.href);
}

export function DestinationSection({ config, onChange, metadataService, formXmlService,
  readOnly, onAccessibleTablesChange, errors, warnings }: DestinationSectionProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const { tables } = useAccessibleTables(metadataService);
  const tableLabel = (logicalName: string): string =>
    tables.find(table => table.logicalName === logicalName)?.displayName ?? logicalName;
  const { target, trigger, host, context } = config;
  const { source } = context;
  const creating = isCreating(target);
  const recordTarget = RECORD_TARGETS.includes(target.pageType);
  const [resolvedLookup, setResolvedLookup] = useState<{
    service: typeof metadataService;
    hostTable: string;
    lookupName: string;
    metadata?: LookupAttributeInfo;
  } | null>(null);
  const currentLookup = source.kind === 'lookup' && resolvedLookup?.service === metadataService &&
    resolvedLookup.hostTable === host.entityName && resolvedLookup.lookupName === source.attribute
    ? resolvedLookup.metadata : undefined;
  const resolvedTargets = Array.isArray(currentLookup?.Targets) ? [...new Set(currentLookup.Targets)] : [];
  const destination = destinationTable(config);
  const allowed = allowedSources(config);
  const relatedTarget = source.kind === 'lookup' && target.pageType === 'entityrecord' && !creating;
  const tableConfirmed = relatedTarget ? resolvedTargets.length === 1 : !!destination;

  return (
    <>
      <Field label="Content type" required>
        <ChoiceGroup label="Content type" options={PAGE_TYPE_OPTIONS.filter(option => allowedTargets(trigger.kind).includes(option.value as PageType))}
          value={target.pageType}
          onChange={value => onChange(prev => {
            if (prev.target.pageType === value) return prev;
            const next = { ...prev, target: resetTarget(value as PageType) };
            return value === 'entityrecord' && currentLookup ? applyLookup(next, host.entityName, currentLookup) : next;
          })} />
      </Field>
      {target.pageType === 'custom' && (
        <Field label="Custom page name" required hint="Logical name from your solution (e.g. sps_MyPage)" error={errors['target.name']}>
          <Input value={target.name} disabled={readOnly} placeholder="sps_SidePaneBuilderPage" error={!!errors['target.name']}
            onChange={name => onChange(prev => patchTarget(prev, 'custom', { name }))} />
        </Field>
      )}
      {target.pageType === 'entityrecord' && (
        <Field label="Record">
          <ChoiceGroup label="Record" options={RECORD_MODE_OPTIONS} value={creating ? 'create' : 'open'}
            onChange={value => onChange(prev => patchTarget(prev, 'entityrecord', { createNew: value === 'create' }))} />
        </Field>
      )}
      {recordTarget && (
        <Field label="Record source" error={errors['context.source']}
          hint={allowed.length === 1 ? 'Set by the trigger.' : undefined}>
          <ChoiceGroup label="Record source"
            options={allowed.map(kind => kind === 'none' && creating
              ? { ...SOURCE_OPTIONS.none, desc: 'Open a blank form' } : SOURCE_OPTIONS[kind])}
            value={source.kind}
            onChange={value => onChange(prev => prev.context.source.kind === value ? prev : {
              ...prev, context: { ...prev.context, source: defaultSource(value as RecordSourceKind) },
            })} />
        </Field>
      )}
      {source.kind === 'lookup' && recordTarget && (
        <Field label="Lookup column" required hint="Lookup on the trigger table whose value opens in the pane"
          error={errors['context.source.attribute']}>
          <LookupPicker entityName={host.entityName} value={source.attribute} metadataService={metadataService}
            disabled={readOnly} error={!!errors['context.source.attribute']} showDestination={false}
            onChange={(value, selected) => onChange(prev => applyLookup(prev, host.entityName,
              selected ?? (value ? { LogicalName: value } : null)))}
            onSelectionChange={lookup => setResolvedLookup({
              service: metadataService, hostTable: host.entityName,
              lookupName: lookup?.LogicalName ?? '', metadata: lookup,
            })}
            onResolvedSelection={lookup => {
              setResolvedLookup({ service: metadataService, hostTable: host.entityName,
                lookupName: source.attribute, metadata: lookup });
              if (lookup?.LogicalName === source.attribute) {
                onChange(prev => prev.context.source.kind === 'lookup' && prev.context.source.attribute === lookup.LogicalName
                  ? applyLookup(prev, host.entityName, lookup) : prev);
              }
            }} />
        </Field>
      )}
      {source.kind === 'fixed' && recordTarget && (
        <>
          <Field label="Record ID" hint="GUID of the specific record" error={errors['context.source.id']}>
            <div onBlurCapture={event => {
              const normalized = normalizeGuid((event.target as HTMLInputElement).value);
              if (normalized) onChange(prev => patchSource(prev, 'fixed', { id: normalized }));
            }}>
              <Input value={source.id} disabled={readOnly} placeholder="00000000-0000-0000-0000-000000000000"
                error={!!errors['context.source.id']}
                onChange={id => onChange(prev => patchSource(prev, 'fixed', { id }))} />
            </div>
          </Field>
          {target.pageType !== 'entityrecord' && (
            <Field label="Record table" error={errors['context.source.entityName']}>
              <TablePicker ariaLabel="Record table" value={source.entityName} metadataService={metadataService}
                disabled={readOnly} error={!!errors['context.source.entityName']}
                onChange={entityName => onChange(prev => patchSource(prev, 'fixed', { entityName }))} />
            </Field>
          )}
        </>
      )}
      {sendsRecord(config) && (
        <Field label="Variable name" hint="Name used for the resolved record ID in generated JavaScript"
          error={errors['context.variableName']}>
          <Input value={context.variableName} disabled={readOnly} placeholder="recordId"
            error={!!errors['context.variableName']}
            onChange={variableName => onChange(prev => ({
              ...prev, context: { ...prev.context, variableName },
            }))} />
        </Field>
      )}
      {target.pageType === 'entityrecord' && (
        <>
          <Field label="Destination table" required={creating || source.kind === 'fixed'}
            error={errors['target.entityName']}
            hint={relatedTarget ? 'Derived from the selected lookup' : undefined}>
            {creating || source.kind === 'fixed' ? (
              <TablePicker ariaLabel="Destination table" value={target.entityName} metadataService={metadataService}
                disabled={readOnly} error={!!errors['target.entityName']} onAccessibleTablesChange={onAccessibleTablesChange}
                onChange={entityName => onChange(prev => prev.target.pageType !== 'entityrecord' || prev.target.entityName === entityName ? prev
                  // Form data names columns of the previous table; a first pick keeps data typed before any table was chosen.
                  : patchTarget(prev, 'entityrecord', { entityName, formId: '', tabName: '', data: prev.target.entityName ? '' : prev.target.data }))} />
            ) : (
              <div role="status" aria-live="polite" style={{ color: T.fg2, fontFamily: T.font, fontSize: 13 }}>
                {relatedTarget
                  ? resolvedTargets.length === 1
                    ? <>
                        <div>{tableLabel(resolvedTargets[0])}</div>
                        <div>Destination table: determined by the {source.attribute} lookup.</div>
                      </>
                    : resolvedTargets.length > 1
                      ? `Possible destination tables: ${resolvedTargets.map(tableLabel).join(', ')}. Determined by the selected row.`
                      : !source.attribute
                        ? "Destination table is determined by the 'Lookup column' selector."
                        : target.entityName
                          ? <>
                              <div>{tableLabel(target.entityName)}</div>
                              <div>Saved table selection “{target.entityName}” is unconfirmed until the lookup is resolved.</div>
                            </>
                          : `Destination table: determined by the ${source.attribute} lookup.`
                  : source.kind === 'clickedTag'
                    ? 'Destination table: determined by the clicked tag.'
                    : `Destination table: ${destination || '(table)'}`}
              </div>
            )}
          </Field>
          {/* The clicked tag names the table at runtime, so no form or tab of it can be chosen here. */}
          {formXmlService && source.kind !== 'clickedTag' && (
            <Field label="Form" error={errors['target.formId']}
              hint={!tableConfirmed ? 'Choose a table to pick a form.' : undefined}>
              <FormSelector entityName={destination} onEntityNameChange={() => undefined}
                selectedFormId={target.formId} hideEntityPicker disabled={readOnly || !tableConfirmed}
                formXmlService={formXmlService} metadataService={metadataService}
                onFormSelected={selection => onChange(prev => patchTarget(prev, 'entityrecord',
                  { formId: selection?.formId ?? '', tabName: '' }))} />
            </Field>
          )}
          {source.kind !== 'clickedTag' && (
            <Field label="Tab name" hint={!tableConfirmed ? 'Choose a table to pick a form.' : 'Logical name of the form tab to focus'}>
              <Input value={target.tabName} disabled={readOnly || !tableConfirmed}
                onChange={tabName => onChange(prev => patchTarget(prev, 'entityrecord', { tabName }))} />
            </Field>
          )}
          <JsonDataField label="Form data" value={target.data} disabled={readOnly} placeholder={FORM_DATA_EXAMPLE}
            error={errors['target.data']}
            hint="Optional JSON object of extra form parameters. Keys are column logical names (e.g. name) or pre-registered custom params. Lookups need a pair/triple: primarycontactid + primarycontactidname, or parentcustomerid + parentcustomeridname + parentcustomeridtype (account|contact|systemuser|team)."
            onChange={data => onChange(prev => patchTarget(prev, 'entityrecord', { data }))}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" disabled={readOnly} onClick={() => onChange(prev => patchTarget(prev, 'entityrecord', { data: FORM_DATA_EXAMPLE }))}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: T.rM, border: `1px solid ${T.stroke1}`,
                  background: T.surface2, color: T.fg1, fontFamily: T.font, cursor: readOnly ? 'default' : 'pointer' }}>Insert example</button>
              <span style={{ fontSize: 11, color: T.fg3, fontFamily: T.font }}>
                <a href="https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/set-field-values-using-parameters-passed-form"
                  target="_blank" rel="noreferrer" onClick={openDocsLink} style={{ color: T.accent }}>Set column values</a>
                {' · '}
                <a href="https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/configure-form-accept-custom-querystring-parameters"
                  target="_blank" rel="noreferrer" onClick={openDocsLink} style={{ color: T.accent }}>Custom query-string params</a>
              </span>
            </div>
            <Callout type="info" icon="ℹ">{creating
              ? 'In create mode these values pre-fill columns on the new record.'
              : 'Open existing record ignores column default values. Only pre-registered custom params take effect, and any invalid key fails the navigate at runtime. Choose Create new record to pre-fill columns.'}</Callout>
          </JsonDataField>
        </>
      )}
      {target.pageType === 'entitylist' && (
        <>
          <Field label="Destination table" required error={errors['target.entityName']}>
            <TablePicker ariaLabel="Destination table" value={target.entityName} metadataService={metadataService}
              disabled={readOnly} error={!!errors['target.entityName']} onAccessibleTablesChange={onAccessibleTablesChange}
              onChange={entityName => onChange(prev => patchTarget(prev, 'entitylist', { entityName, viewId: '', viewType: '' }))} />
          </Field>
          <Field label="View" error={errors['target.viewId'] || errors['target.viewType']}>
            <ViewPicker entityName={target.entityName} value={target.viewId} viewType={target.viewType}
              metadataService={metadataService} disabled={readOnly}
              onChange={view => onChange(prev => patchTarget(prev, 'entitylist', { viewId: view?.id ?? '', viewType: view?.viewType ?? '' }))} />
          </Field>
        </>
      )}
      {target.pageType === 'generative' && (
        <>
          <Field label="Page ID" required hint="In the app designer, select the page; the properties pane shows the ID in the Generative page field"
            error={errors['target.pageId']}>
            <Input value={target.pageId} disabled={readOnly} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              error={!!errors['target.pageId']} onChange={pageId => onChange(prev => patchTarget(prev, 'generative', { pageId }))} />
          </Field>
          <JsonDataField label="Page data" hint="Optional JSON object the page reads as pageInput.data"
            value={target.data} disabled={readOnly} error={errors['target.data']}
            onChange={data => onChange(prev => patchTarget(prev, 'generative', { data }))} />
          {warnings['target.pageType'] && <Callout type="warn" icon="⚠">
            {warnings['target.pageType']}{' '}
            <a href={GENERATIVE_INPUTS_DOC} target="_blank" rel="noreferrer" onClick={openDocsLink}
              style={{ color: T.accent }}>Set up a page to accept input parameters</a>
          </Callout>}
        </>
      )}
      {target.pageType === 'webresource' && (
        <>
          <Field label="Web resource name" required hint="Logical name (e.g. sps_/pages/helper.html)" error={errors['target.name']}>
            <Input value={target.name} disabled={readOnly} placeholder="sps_/pages/helper.html"
              error={!!errors['target.name']} onChange={name => onChange(prev => patchTarget(prev, 'webresource', { name }))} />
          </Field>
          <Callout type="warn" icon="⚠">Web resources inside a side pane do NOT have access to <code>Xrm</code> or <code>parent.Xrm</code>. Pass data via URL <code>data</code> parameter (URL-encoded JSON).</Callout>
        </>
      )}
      {target.pageType === 'dashboard' && (
        <Field label="Dashboard" required hint="Select a system or personal dashboard" error={errors['target.dashboardId']}>
          <DashboardPicker value={target.dashboardId} metadataService={metadataService} disabled={readOnly}
            error={!!errors['target.dashboardId']}
            onChange={(dashboardId, dashboardName) => onChange(prev => patchTarget(prev, 'dashboard', { dashboardId, dashboardName }))} />
        </Field>
      )}
      {target.pageType === 'search' && (
        <>
          <Field label="Search text" hint="Pre-fill the global search box (optional)">
            <Input value={target.searchText} disabled={readOnly} placeholder="e.g. Contoso"
              onChange={searchText => onChange(prev => patchTarget(prev, 'search', { searchText }))} />
          </Field>
          {warnings['target.pageType'] && <Callout type="warn" icon="⚠">{warnings['target.pageType']}</Callout>}
        </>
      )}
      {warnings['target.createNew'] && <Callout type="warn" icon="⚠">{warnings['target.createNew']}</Callout>}
      {warnings['context.source'] && <Callout type="warn" icon="⚠">{warnings['context.source']}</Callout>}
      {errors['context.source'] && <Callout type="err" icon="✕">{errors['context.source']}</Callout>}
    </>
  );
}
