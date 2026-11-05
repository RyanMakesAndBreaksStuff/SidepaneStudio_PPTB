import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import type { MetadataFilterConfig } from '../types/MetadataFilterConfig';
import type { MetadataFilterDraft } from './config/MetadataFilterConfigEditor';
import type { ValidationResult } from '../services/ValidationService';
import type { MetadataService } from '../services/MetadataService';
import type { FormXmlService } from '../services/FormXmlService';
import type { SummarySlot } from '../services/describeConfig';
import { Section } from './Section';
import { TriggerSection } from './config/TriggerSection';
import { DestinationSection } from './config/DestinationSection';
import { PaneSection } from './config/PaneSection';

/** A request from the sentence strip to reveal the section that owns `slot`; `seq` makes repeats observable. */
export interface JumpRequest { slot: SummarySlot; seq: number }

export interface ConfigurePanelProps {
  config: PaneDefinitionConfig;
  onChange: (updater: (prev: PaneDefinitionConfig) => PaneDefinitionConfig) => void;
  validation: ValidationResult;
  readOnly?: boolean;
  metadataService: MetadataService;
  formXmlService?: FormXmlService;
  onAccessibleTablesChange?: (tables: Set<string> | undefined) => void;
  metadataFilterConfig?: MetadataFilterConfig;
  defaultMetadataFilterConfig?: MetadataFilterConfig;
  metadataFilterPersistenceAvailable?: boolean;
  metadataFilterError?: string | null;
  onSaveMetadataFilterConfig?: (config: MetadataFilterConfig) => Promise<void> | void;
  onResetMetadataFilterConfig?: () => Promise<void> | void;
  metadataFilterDraft?: MetadataFilterDraft | null;
  onMetadataFilterDraftChange?: (draft: MetadataFilterDraft | null) => void;
  jumpRequest?: JumpRequest;
}

export function ConfigurePanel(props: ConfigurePanelProps): React.ReactElement {
  const { config, onChange, validation, readOnly, metadataService, onAccessibleTablesChange,
    formXmlService, metadataFilterConfig, defaultMetadataFilterConfig, metadataFilterPersistenceAvailable,
    metadataFilterError, onSaveMetadataFilterConfig, onResetMetadataFilterConfig,
    metadataFilterDraft, onMetadataFilterDraftChange } = props;
  const [paneOpen, setPaneOpen] = useState(false);
  const [triggerOpen, setTriggerOpen] = useState(true);
  const [destinationOpen, setDestinationOpen] = useState(true);
  const errors = useMemo(() => Object.fromEntries(validation.errors.map(error => [error.field, error.message])), [validation.errors]);
  const warnings = useMemo(() => Object.fromEntries(validation.warnings.map(warning => [warning.field, warning.message])), [validation.warnings]);
  const { jumpRequest } = props;
  useEffect(() => {
    if (!jumpRequest) return;
    const { slot } = jumpRequest;
    if (slot === 'pane') setPaneOpen(true);
    else if (slot === 'trigger' || slot === 'host') setTriggerOpen(true);
    else setDestinationOpen(true);
  }, [jumpRequest]);
  const sectionProps = { config, onChange, errors, warnings, metadataService, readOnly, onAccessibleTablesChange };
  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden',
      opacity: readOnly ? 0.7 : 1, pointerEvents: readOnly ? 'none' : 'auto' }}>
      <Section title="Trigger & source" icon="1" open={triggerOpen} onOpenChange={setTriggerOpen}>
        <TriggerSection {...sectionProps} formXmlService={formXmlService} />
      </Section>
      <Section title="Destination" icon="2" open={destinationOpen} onOpenChange={setDestinationOpen}>
        <DestinationSection {...sectionProps} formXmlService={formXmlService} />
      </Section>
      <Section title="Pane & behaviour" icon="3" open={paneOpen} onOpenChange={setPaneOpen}>
        <PaneSection {...sectionProps} metadataFilterConfig={metadataFilterConfig}
          defaultMetadataFilterConfig={defaultMetadataFilterConfig}
          metadataFilterPersistenceAvailable={metadataFilterPersistenceAvailable}
          metadataFilterError={metadataFilterError}
          onSaveMetadataFilterConfig={onSaveMetadataFilterConfig}
          onResetMetadataFilterConfig={onResetMetadataFilterConfig}
          metadataFilterDraft={metadataFilterDraft} onMetadataFilterDraftChange={onMetadataFilterDraftChange} />
      </Section>
    </div>
  );
}
