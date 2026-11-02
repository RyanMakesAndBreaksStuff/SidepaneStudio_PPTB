import * as React from 'react';
import type { ConfigurePanelProps } from '../ConfigurePanel';
import type { TriggerKind } from '../../types/PaneDefinitionConfig';
import { TRIGGER_CAPABILITIES, TRIGGER_KINDS } from '../../services/triggerCapabilities';
import { changeHostTable } from '../../services/relatedRecordConfig';
import { Field } from '../Field';
import { ChoiceGroup } from '../ChoiceGroup';
import { TablePicker } from '../TablePicker';
import { FormSelector } from '../FormSelector';
import { ViewPicker } from '../ViewPicker';
import { ColumnPicker } from './ColumnPicker';
import { LookupControlsPicker } from './LookupControlsPicker';
import { Input } from '../Input';

export type SectionSharedProps = Pick<ConfigurePanelProps,
  'config' | 'onChange' | 'metadataService' | 'readOnly' | 'onAccessibleTablesChange'> & {
  errors: Record<string, string>;
  warnings: Record<string, string>;
};

export interface TriggerSectionProps extends SectionSharedProps {
  formXmlService?: ConfigurePanelProps['formXmlService'];
}

export function TriggerSection({ config, onChange, metadataService, readOnly, onAccessibleTablesChange,
  formXmlService, errors }: TriggerSectionProps): React.ReactElement {
  const { trigger, host } = config;
  const caps = TRIGGER_CAPABILITIES[trigger.kind];
  return (
    <>
      <Field label="Trigger type" required>
        <ChoiceGroup name="triggerKind"
          options={TRIGGER_KINDS.map(kind => ({ value: kind, label: TRIGGER_CAPABILITIES[kind].label, desc: TRIGGER_CAPABILITIES[kind].desc }))}
          value={trigger.kind}
          onChange={value => onChange(prev => ({ ...prev, trigger: { ...prev.trigger, kind: value as TriggerKind } }))} />
      </Field>
      {caps.family === 'grid' && (
        <Field label="Grid surface">
          <ChoiceGroup name="gridSurface" options={[
            { value: 'main', label: 'Main grid' }, { value: 'subgrid', label: 'Subgrid' },
          ]} value={trigger.surface}
            onChange={surface => onChange(prev => TRIGGER_CAPABILITIES[prev.trigger.kind].family !== 'grid' ? prev
              : { ...prev, trigger: { ...prev.trigger, surface: surface as 'main' | 'subgrid' } })} />
        </Field>
      )}
      {caps.hostPicker !== null && (
        <Field label="Trigger table" error={errors['host.entityName']}
          hint={caps.family === 'grid' ? 'The grid the command or row event belongs to' : 'Leave empty to read the table at runtime'}>
          <TablePicker ariaLabel="Trigger table" value={host.entityName} metadataService={metadataService}
            onChange={entityName => onChange(prev => changeHostTable(prev, entityName))}
            error={!!errors['host.entityName']} disabled={readOnly}
            onAccessibleTablesChange={onAccessibleTablesChange} />
        </Field>
      )}
      {caps.hostPicker === 'form' && formXmlService && (
        <Field label="Form">
          <FormSelector entityName={host.entityName} onEntityNameChange={() => undefined}
            selectedFormId={host.formId} hideEntityPicker disabled={readOnly || !host.entityName}
            formXmlService={formXmlService} metadataService={metadataService}
            onFormSelected={selection => onChange(prev => TRIGGER_CAPABILITIES[prev.trigger.kind].hostPicker !== 'form' ? prev
              : { ...prev, host: { ...prev.host, formId: selection?.formId ?? '' } })} />
        </Field>
      )}
      {caps.hostPicker === 'view' && (
        <Field label="View">
          <ViewPicker entityName={host.entityName} value={host.viewId} viewType={host.viewType}
            metadataService={metadataService} disabled={readOnly}
            onChange={view => onChange(prev => TRIGGER_CAPABILITIES[prev.trigger.kind].hostPicker !== 'view' ? prev
              : { ...prev, host: { ...prev.host, viewId: view?.id ?? '', viewType: view?.viewType ?? '' } })} />
        </Field>
      )}
      {caps.hostPicker === 'column' && (
        <Field label="Column" required error={errors['host.attribute']}>
          <ColumnPicker entityName={host.entityName} value={host.attribute} metadataService={metadataService}
            disabled={readOnly} error={!!errors['host.attribute']}
            onChange={attribute => onChange(prev => prev.trigger.kind !== 'FormOnChange' ? prev
              : { ...prev, host: { ...prev.host, attribute } })} />
        </Field>
      )}
      {caps.hostPicker === 'lookup' && (
        <Field label="Lookup controls" required error={errors['host.lookupControls']}>
          <LookupControlsPicker entityName={host.entityName} value={host.lookupControls} metadataService={metadataService}
            disabled={readOnly} error={!!errors['host.lookupControls']}
            onChange={lookupControls => onChange(prev => prev.trigger.kind !== 'LookupTagClick' ? prev
              : { ...prev, host: { ...prev.host, lookupControls } })} />
        </Field>
      )}
      {caps.family !== 'manual' && (
        <>
          <Field label="Function name" hint={`Full call: ${trigger.namespace || 'Ns'}.${trigger.functionName || 'fn'}`}>
            <Input value={trigger.functionName} disabled={readOnly} placeholder="openRelatedRecordsPane"
              onChange={functionName => onChange(prev => ({ ...prev, trigger: { ...prev.trigger, functionName } }))} />
          </Field>
          <Field label="Namespace" hint="JavaScript namespace prefix">
            <Input value={trigger.namespace} disabled={readOnly} placeholder="Contoso"
              onChange={namespace => onChange(prev => ({ ...prev, trigger: { ...prev.trigger, namespace } }))} />
          </Field>
        </>
      )}
    </>
  );
}
