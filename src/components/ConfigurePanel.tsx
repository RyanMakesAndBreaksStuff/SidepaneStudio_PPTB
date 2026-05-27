// src/components/ConfigurePanel.tsx
import * as React from 'react';
import { useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { ValidationResult } from '../services/ValidationService';
import { MetadataService } from '../services/MetadataService';
import { Section } from './Section';
import { Field } from './Field';
import { Input } from './Input';
import { Select } from './Select';
import { TablePicker } from './TablePicker';
import { Toggle } from './Toggle';
import { ChoiceGroup } from './ChoiceGroup';
import { Callout } from './Callout';
import { WidthPicker } from './WidthPicker';
import { MIN_CONFIG_WIDTH, MAX_CONFIG_WIDTH } from './previewHelpers';

export interface ConfigurePanelProps {
  config: PaneDefinitionConfig;
  onChange: (updater: (prev: PaneDefinitionConfig) => PaneDefinitionConfig) => void;
  validation: ValidationResult;
  readOnly?: boolean;
  metadataService: MetadataService;
  onAccessibleTablesChange?: (tables: Set<string> | undefined) => void;
}

const PAGE_TYPE_OPTIONS = [
  { value: 'custom',       label: 'Custom page',    desc: 'A canvas app page in your solution' },
  { value: 'entityrecord', label: 'Table record',    desc: 'Open a specific or context-driven record' },
  { value: 'entitylist',   label: 'Table list',      desc: 'Show a view of table records' },
  { value: 'webresource',  label: 'Web resource',    desc: 'Embed an HTML/JS web resource' },
  { value: 'dashboard',    label: 'Dashboard',       desc: 'System or personal dashboard', phase: 'Coming soon', disabled: true },
  { value: 'search',       label: 'Search',          desc: 'Global search results', phase: 'Coming soon', disabled: true },
];

const TRIGGER_OPTIONS = [
  { value: 'FormOnLoad',     label: 'Form on load',                 desc: 'Opens when a record form loads' },
  { value: 'FormButton',     label: 'Command bar button (form)',     desc: 'Wired to a button in the form command bar' },
  { value: 'MainGridButton', label: 'Command bar button (grid)',     desc: 'Main grid command' },
  { value: 'SubgridButton',  label: 'Command bar button (subgrid)', desc: 'Subgrid command' },
  { value: 'ManualJS',       label: 'Console / Manual',             desc: 'Paste into browser console (F12)' },
  { value: 'FormOnChange',   label: 'Field on change',              desc: 'Registers an onChange handler on a specific field' },
];

const CONTEXT_OPTIONS = [
  { value: 'CurrentRecord', label: 'Current record (from trigger)' },
  { value: 'SelectedRow',   label: 'Selected row (subgrid)' },
  { value: 'Static',        label: 'Static record ID' },
  { value: 'None',          label: 'None — pane opens independently' },
];

export function ConfigurePanel({
  config,
  onChange,
  validation,
  readOnly,
  metadataService,
  onAccessibleTablesChange,
}: ConfigurePanelProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);

  const patch = useCallback(<S extends keyof PaneDefinitionConfig>(
    section: S,
    key: keyof PaneDefinitionConfig[S],
    value: PaneDefinitionConfig[S][typeof key]
  ) => {
    onChange(prev => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }));
  }, [onChange]);

  const { pane, target, trigger, context } = config;
  const vErrors: Record<string, string> = Object.fromEntries(
    validation.errors.map(e => [e.field, e.message])
  );

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', opacity: readOnly ? 0.7 : 1, pointerEvents: readOnly ? 'none' : 'auto' }}>

      {/* 1 · What opens in the pane */}
      <Section title="What opens in the pane" icon="📋" defaultOpen={false}>
        <Field label="Content type" required>
          <ChoiceGroup
            name="pageType"
            options={PAGE_TYPE_OPTIONS}
            value={target.pageType}
            onChange={v => patch('target', 'pageType', v as PaneDefinitionConfig['target']['pageType'])}
          />
        </Field>

        {target.pageType === 'custom' && (
          <Field label="Custom page name" required hint="Logical name from your solution (e.g. cpp_MyPage)" error={vErrors['target.name']}>
            <Input
              value={target.name}
              onChange={v => patch('target', 'name', v)}
              placeholder="cpp_SidePaneBuilderPage"
              error={!!vErrors['target.name']}
            />
          </Field>
        )}

        {(target.pageType === 'entityrecord' || target.pageType === 'entitylist') && (
          <Field label="Table name" required hint="Logical name of the Dataverse table" error={vErrors['target.entityName']}>
            <TablePicker
              value={target.entityName}
              onChange={v => patch('target', 'entityName', v)}
              metadataService={metadataService}
              error={!!vErrors['target.entityName']}
              disabled={readOnly}
              onAccessibleTablesChange={onAccessibleTablesChange}
            />
          </Field>
        )}

        {target.pageType === 'webresource' && (
          <>
            <Field label="Web resource name" required hint="Logical name (e.g. cpp_/pages/helper.html)" error={vErrors['target.name']}>
              <Input value={target.name} onChange={v => patch('target', 'name', v)} placeholder="cpp_/pages/helper.html" error={!!vErrors['target.name']} />
            </Field>
            <Callout type="warn" icon="⚠">
              Web resources inside a side pane do NOT have access to <code>Xrm</code> or <code>parent.Xrm</code>. Pass data via URL <code>data</code> parameter (URL-encoded JSON).
            </Callout>
          </>
        )}
      </Section>

      {/* 2 · Pane Appearance */}
      <Section title="Pane Appearance" icon="🎨" defaultOpen={false}>
        <Field label="Pane title">
          <Input value={pane.title} onChange={v => patch('pane', 'title', v)} placeholder="My Side Pane" />
        </Field>

        <Field label="Tab icon" hint="Web resource path — must be published before it renders">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 34, height: 34, background: T.surface3, border: `2px dashed ${T.stroke1}`,
              borderRadius: T.rM, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.fg3, fontSize: 15, flexShrink: 0,
            }}>🖼</div>
            <Input value={pane.imageSrc} onChange={v => patch('pane', 'imageSrc', v)} placeholder="cpp_/icons/myicon.svg" />
          </div>
          {pane.imageSrc && (
            <Callout type="warn" icon="⚠">Icon will render in the live app once the web resource is published. Showing placeholder in preview.</Callout>
          )}
        </Field>

        <Field label="Width" hint={`Min ${MIN_CONFIG_WIDTH}px · Max ${MAX_CONFIG_WIDTH}px · Recommended 400–600px · Current: ${pane.width}px`}>
          <WidthPicker
            value={pane.width}
            onChange={v => patch('pane', 'width', v)}
            step={10}
          />
        </Field>

        <Toggle label="Show close button" desc="Users can dismiss the pane with ×" checked={pane.canClose} onChange={v => patch('pane', 'canClose', v)} />
        <Toggle label="Hide header bar" desc="Removes title and close button area" checked={pane.hideHeader} onChange={v => patch('pane', 'hideHeader', v)} />

        {vErrors['pane.hideHeader'] && (
          <Callout type="err" icon="✕">{vErrors['pane.hideHeader']}</Callout>
        )}

        <Toggle label="Resizable by user" desc="User can drag the edge to resize" checked={pane.isResizable} onChange={v => patch('pane', 'isResizable', v)} />
      </Section>

      {/* 3 · How makers launch this pane */}
      <Section title="How makers launch this pane" icon="🚀" defaultOpen={false}>
        <Field label="Trigger type" required>
          <ChoiceGroup
            name="triggerKind"
            options={TRIGGER_OPTIONS}
            value={trigger.kind}
            onChange={v => patch('trigger', 'kind', v as PaneDefinitionConfig['trigger']['kind'])}
          />
        </Field>

        <Field label="Unique pane ID" required hint="Stable key — used to reuse or find this pane" error={vErrors['pane.paneId']}>
          <Input value={pane.paneId} onChange={v => patch('pane', 'paneId', v)} placeholder="relatedRecordsPane" error={!!vErrors['pane.paneId']} />
        </Field>

        {trigger.kind !== 'ManualJS' && (
          <>
            <Field label="Function name" hint={`Full call: ${trigger.namespace || 'Ns'}.${trigger.functionName || 'fn'}`}>
              <Input value={trigger.functionName} onChange={v => patch('trigger', 'functionName', v)} placeholder="openRelatedRecordsPane" />
            </Field>
            <Field label="Namespace" hint="JavaScript namespace prefix">
              <Input value={trigger.namespace} onChange={v => patch('trigger', 'namespace', v)} placeholder="Contoso" />
            </Field>
          </>
        )}

        {trigger.kind === 'FormOnChange' && (
          <Field label="Field name" required hint="Logical name of the field to watch for changes" error={vErrors['trigger.fieldName']}>
            <Input
              value={trigger.fieldName}
              onChange={v => patch('trigger', 'fieldName', v)}
              placeholder="new_fieldname"
              error={!!vErrors['trigger.fieldName']}
            />
          </Field>
        )}
      </Section>

      {/* 4 · Record context */}
      <Section title="Record context" icon="🗂" defaultOpen={false}>
        <Field label="Context mode">
          <Select
            value={context.mode}
            onChange={v => patch('context', 'mode', v as PaneDefinitionConfig['context']['mode'])}
            options={CONTEXT_OPTIONS}
          />
        </Field>

        {context.mode === 'Static' && (
          <>
            <Field label="Table name" hint="Logical name of the record's table" error={vErrors['context.entityName']}>
              <Input value={context.entityName} onChange={v => patch('context', 'entityName', v)} placeholder="account" error={!!vErrors['context.entityName']} />
            </Field>
            <Field label="Record ID" hint="GUID of the specific record" error={vErrors['context.staticRecordId']}>
              <Input value={context.staticRecordId} onChange={v => patch('context', 'staticRecordId', v)} placeholder="00000000-0000-0000-0000-000000000000" error={!!vErrors['context.staticRecordId']} />
            </Field>
            <Callout type="warn" icon="⚠">
              This record ID is environment-specific and will not transfer automatically to other environments. You must update it after importing this definition.
            </Callout>
          </>
        )}

        <Toggle
          label="Reuse open pane"
          desc="Focus instead of reloading if already open"
          checked={context.reuseExistingPane}
          onChange={v => patch('context', 'reuseExistingPane', v)}
        />
      </Section>

      {/* 5 · Advanced options */}
      <Section title="Advanced options" icon="⚙" defaultOpen={false}>
        <Toggle
          label="Open in foreground (isSelected)"
          desc="Pane expands automatically when opened"
          checked={pane.isSelected}
          onChange={v => patch('pane', 'isSelected', v)}
        />

        {!pane.isSelected && trigger.kind === 'FormOnLoad' && (
          <Callout type="info" icon="ℹ">Pane will load in the background without opening. Users will see the tab in the rail but the panel will not expand automatically.</Callout>
        )}

        <Toggle
          label="Keep loaded when inactive"
          desc="Prevents content unmount on tab switch"
          checked={pane.alwaysRender}
          onChange={v => patch('pane', 'alwaysRender', v)}
        />

        {pane.alwaysRender && (
          <Callout type="warn" icon="⚠">
            This keeps the pane loaded in memory even when hidden. Use only when fast reload is required. <strong>Increases memory usage</strong> in the user's browser.
          </Callout>
        )}

        <Toggle
          label="Keep badge on select"
          desc="Badge count persists when user opens the pane"
          checked={pane.keepBadgeOnSelect}
          onChange={v => patch('pane', 'keepBadgeOnSelect', v)}
        />

        <Field label="Initial badge value" hint="0 = no badge shown">
          <Input type="number" value={pane.badgeValue} onChange={v => patch('pane', 'badgeValue', +v)} />
        </Field>
      </Section>
    </div>
  );
}
