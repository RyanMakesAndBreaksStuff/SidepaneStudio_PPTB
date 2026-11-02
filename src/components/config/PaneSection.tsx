import * as React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { theme } from '../../theme/tokens';
import type { ConfigurePanelProps } from '../ConfigurePanel';
import { MIN_CONFIG_WIDTH, MAX_CONFIG_WIDTH } from '../../types/PaneDefinitionConfig';
import { Field } from '../Field';
import { Input } from '../Input';
import { Toggle } from '../Toggle';
import { Callout } from '../Callout';
import { WidthPicker } from '../WidthPicker';
import { MetadataFilterConfigEditor } from './MetadataFilterConfigEditor';
import type { SectionSharedProps } from './TriggerSection';

export type PaneSectionProps = SectionSharedProps & Pick<ConfigurePanelProps,
  'metadataFilterConfig' | 'defaultMetadataFilterConfig' | 'metadataFilterPersistenceAvailable' |
  'metadataFilterError' | 'onSaveMetadataFilterConfig' | 'onResetMetadataFilterConfig'>;

export function PaneSection({ config, onChange, readOnly, errors, warnings, metadataFilterConfig,
  defaultMetadataFilterConfig, metadataFilterPersistenceAvailable = false, metadataFilterError,
  onSaveMetadataFilterConfig, onResetMetadataFilterConfig }: PaneSectionProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const { pane, behavior, trigger } = config;
  const patchPane = <K extends keyof typeof pane>(key: K, value: (typeof pane)[K]) =>
    onChange(prev => ({ ...prev, pane: { ...prev.pane, [key]: value } }));
  const patchBehavior = <K extends keyof typeof behavior>(key: K, value: (typeof behavior)[K]) =>
    onChange(prev => ({ ...prev, behavior: { ...prev.behavior, [key]: value } }));
  return (
    <>
      <Field label="Unique pane ID" required hint="Stable key — used to reuse or find this pane" error={errors['pane.paneId']}>
        <Input value={pane.paneId} disabled={readOnly} placeholder="relatedRecordsPane"
          error={!!errors['pane.paneId']} onChange={value => patchPane('paneId', value)} />
      </Field>
      <Field label="Pane title">
        <Input value={pane.title} disabled={readOnly} placeholder="My Side Pane" onChange={value => patchPane('title', value)} />
      </Field>
      <Field label="Tab icon" hint="Web resource path — must be published and prefixed with WebResources/ to render">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div aria-hidden="true" style={{ width: 34, height: 34, background: T.surface3,
            border: `2px dashed ${T.stroke1}`, borderRadius: T.rM, display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: T.fg3, fontSize: 15, flexShrink: 0 }}>🖼</div>
          <Input value={pane.imageSrc} disabled={readOnly} placeholder="WebResources/sps_/icons/myicon.svg"
            onChange={value => patchPane('imageSrc', value)} />
        </div>
        {pane.imageSrc && <Callout type="warn" icon="⚠">Icon will render in the live app once the web resource is published. Showing placeholder in preview.</Callout>}
      </Field>
      <Field label="Width" error={errors['pane.width']}
        hint={`Min ${MIN_CONFIG_WIDTH}px · Max ${MAX_CONFIG_WIDTH}px · Recommended 400–600px · Current: ${pane.width}px`}>
        <WidthPicker value={pane.width} onChange={value => patchPane('width', value)} step={10} />
      </Field>
      <Toggle label="Show close button" desc="Users can dismiss the pane with ×"
        checked={pane.canClose} onChange={value => patchPane('canClose', value)} />
      <Toggle label="Hide header bar" desc="Removes title and close button area"
        checked={pane.hideHeader} onChange={value => patchPane('hideHeader', value)} />
      {warnings['pane.hideHeader'] && <Callout type="warn" icon="⚠">{warnings['pane.hideHeader']}</Callout>}
      <div style={{ borderTop: `1px solid ${T.stroke1}`, paddingTop: 10,
        color: T.fg2, fontFamily: T.font, fontSize: 12, fontWeight: 600 }}>Advanced</div>
      <Toggle label="Open in foreground (isSelected)" desc="Pane expands automatically when opened"
        checked={pane.isSelected} onChange={value => patchPane('isSelected', value)} />
      {!pane.isSelected && trigger.kind === 'FormOnLoad' && (
        <Callout type="info" icon="ℹ">Pane will load in the background without opening. Users will see the tab in the rail but the panel will not expand automatically.</Callout>
      )}
      <Toggle label="Keep loaded when inactive" desc="Prevents content unmount on tab switch"
        checked={pane.alwaysRender} onChange={value => patchPane('alwaysRender', value)} />
      {pane.alwaysRender && (
        <Callout type="warn" icon="⚠">This keeps the pane loaded in memory even when hidden. Use only when fast reload is required. <strong>Increases memory usage</strong> in the user's browser.</Callout>
      )}
      <Toggle label="Keep badge on select" desc="Badge count persists when user opens the pane"
        checked={pane.keepBadgeOnSelect} onChange={value => patchPane('keepBadgeOnSelect', value)} />
      <Toggle label="Expand pane on open" desc="Command-bar triggers expand the side pane rail after creating the pane"
        checked={behavior.expandOnOpen} onChange={value => patchBehavior('expandOnOpen', value)} />
      <Toggle label="Close other side panes" desc="Closes every other open pane after this one opens"
        checked={behavior.closeOthers} onChange={value => patchBehavior('closeOthers', value)} />
      <Toggle label="Close if already open" desc="Command bar buttons close this pane when it is open and showing"
        checked={behavior.toggleIfOpen} onChange={value => patchBehavior('toggleIfOpen', value)} />
      {errors['behavior.toggleIfOpen'] && <Callout type="err" icon="✕">{errors['behavior.toggleIfOpen']}</Callout>}
      {warnings['behavior.toggleIfOpen'] && <Callout type="warn" icon="⚠">{warnings['behavior.toggleIfOpen']}</Callout>}
      <Toggle label="Reuse open pane" desc={behavior.reuseExistingPane
        ? 'Navigate the existing pane to the new page, then select it'
        : 'Close and recreate the pane when it is already open'}
        checked={behavior.reuseExistingPane} onChange={value => patchBehavior('reuseExistingPane', value)} />
      <Field label="Initial badge value" hint="0 = no badge shown">
        <Input type="number" value={pane.badgeValue} disabled={readOnly}
          onChange={value => patchPane('badgeValue', +value)} />
      </Field>
      {metadataFilterConfig && defaultMetadataFilterConfig && onSaveMetadataFilterConfig && onResetMetadataFilterConfig && (
        <Field label="Metadata table filters">
          <MetadataFilterConfigEditor config={metadataFilterConfig} defaultConfig={defaultMetadataFilterConfig}
            persistenceAvailable={metadataFilterPersistenceAvailable} error={metadataFilterError}
            onSave={onSaveMetadataFilterConfig} onReset={onResetMetadataFilterConfig} />
        </Field>
      )}
    </>
  );
}
