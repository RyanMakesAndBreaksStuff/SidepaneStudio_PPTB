import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import type { MetadataFilterConfig } from '../types/MetadataFilterConfig';
import type { MetadataFilterDraft } from './config/MetadataFilterConfigEditor';
import { warningsByField, type ValidationResult } from '../services/ValidationService';
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
  /** Called once a jump request has been applied, so its owner can drop it and a later remount does not replay it. */
  onJumpHandled?: (request: JumpRequest) => void;
}

export function ConfigurePanel(props: ConfigurePanelProps): React.ReactElement {
  const { config, onChange, validation, metadataService, onAccessibleTablesChange,
    formXmlService, metadataFilterConfig, defaultMetadataFilterConfig, metadataFilterPersistenceAvailable,
    metadataFilterError, onSaveMetadataFilterConfig, onResetMetadataFilterConfig,
    metadataFilterDraft, onMetadataFilterDraftChange } = props;
  const [paneOpen, setPaneOpen] = useState(false);
  const [triggerOpen, setTriggerOpen] = useState(true);
  const [destinationOpen, setDestinationOpen] = useState(true);
  const errors = useMemo(() => Object.fromEntries(validation.errors.map(error => [error.field, error.message])), [validation.errors]);
  const warnings = useMemo(() => warningsByField(validation.warnings), [validation.warnings]);
  const { jumpRequest, onJumpHandled } = props;
  const triggerHeader = useRef<HTMLButtonElement>(null);
  const destinationHeader = useRef<HTMLButtonElement>(null);
  const paneHeader = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!jumpRequest) return;
    const { slot } = jumpRequest;
    let header = destinationHeader;
    if (slot === 'pane') { setPaneOpen(true); header = paneHeader; }
    else if (slot === 'trigger' || slot === 'host') { setTriggerOpen(true); header = triggerHeader; }
    else setDestinationOpen(true);
    header.current?.scrollIntoView({ block: 'nearest' });
    header.current?.focus({ preventScroll: true });
    onJumpHandled?.(jumpRequest);
  }, [jumpRequest]);
  const sectionProps = { config, onChange, errors, warnings, metadataService, onAccessibleTablesChange };
  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
      <Section title="Trigger & source" icon="1" open={triggerOpen} onOpenChange={setTriggerOpen} headerRef={triggerHeader}>
        <TriggerSection {...sectionProps} formXmlService={formXmlService} />
      </Section>
      <Section title="Destination" icon="2" open={destinationOpen} onOpenChange={setDestinationOpen} headerRef={destinationHeader}>
        <DestinationSection {...sectionProps} formXmlService={formXmlService} />
      </Section>
      <Section title="Pane & behaviour" icon="3" open={paneOpen} onOpenChange={setPaneOpen} headerRef={paneHeader}>
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
