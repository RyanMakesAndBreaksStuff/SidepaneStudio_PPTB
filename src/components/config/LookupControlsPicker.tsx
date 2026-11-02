import * as React from 'react';
import { displayLabel, type MetadataService } from '../../services/MetadataService';
import { useTheme } from '../../contexts/ThemeContext';
import { theme } from '../../theme/tokens';
import { MetadataStatusMessage } from '../MetadataStatusMessage';
import { TableComboBox } from '../TableComboBox';
import { useMetadataRequest } from '../useMetadataRequest';

export interface LookupControlsPickerProps {
  entityName: string;
  value: string[];
  onChange: (next: string[]) => void;
  metadataService: Pick<MetadataService, 'listLookupAttributes'>;
  disabled?: boolean;
  error?: boolean;
}

export function LookupControlsPicker({ entityName, value, onChange, metadataService, disabled, error }: LookupControlsPickerProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const request = useMetadataRequest(
    entityName ? () => metadataService.listLookupAttributes(entityName) : null,
    [metadataService, entityName],
  );
  const lookups = request.data ?? [];
  const items = lookups.filter(lookup => !value.includes(lookup.LogicalName))
    .map(lookup => ({ logicalName: lookup.LogicalName, displayName: displayLabel(lookup) }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  return (
    <div>
      <TableComboBox ariaLabel="Add lookup control" noun="lookup columns" items={items} value=""
        onChange={name => { if (name && !value.includes(name)) onChange([...value, name]); }}
        loading={request.status === 'loading'} error={request.error ?? undefined}
        onRetry={request.retry} invalid={error}
        disabled={disabled || !entityName} placeholder={entityName ? 'Add lookup control…' : 'Select a table first'} />
      <MetadataStatusMessage request={request} disabled={disabled} idleText="Select a table first" loadingText="Loading lookup columns…" />
      <ul aria-label="Selected lookup controls" style={{ listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 6, padding: 0, margin: '8px 0 0' }}>
        {value.map(name => {
          const lookup = lookups.find(item => item.LogicalName === name);
          return <li key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.stroke1}`, borderRadius: T.rS, padding: '2px 6px', color: T.fg1, fontFamily: T.font, fontSize: 12 }}>
            {lookup ? displayLabel(lookup) : name}{request.status === 'loaded' && !lookup ? ' (unavailable)' : ''}
            <button type="button" aria-label={`Remove ${name}`} disabled={disabled} onClick={() => onChange(value.filter(item => item !== name))}
              style={{ border: 0, background: 'transparent', color: T.fg3, cursor: disabled ? 'default' : 'pointer', fontFamily: T.font, padding: '0 2px' }}>×</button>
          </li>;
        })}
      </ul>
    </div>
  );
}
