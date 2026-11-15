import * as React from 'react';
import type { MetadataService } from '../services/MetadataService';
import { TableComboBox } from './TableComboBox';
import { Callout } from './Callout';
import { RetryButton } from './RetryButton';
import { useMetadataRequest } from './useMetadataRequest';

export interface DashboardPickerProps {
  value: string;
  onChange: (id: string, name: string) => void;
  metadataService: Pick<MetadataService, 'listAccessibleDashboards' | 'invalidate'>;
  error?: boolean;
  disabled?: boolean;
}

export function DashboardPicker({
  value,
  onChange,
  metadataService,
  error,
  disabled,
}: DashboardPickerProps): React.ReactElement {
  const request = useMetadataRequest(async () => {
    const result = await metadataService.listAccessibleDashboards();
    if (result.status === 'error') throw new Error(result.reason);
    return result.dashboards;
  }, [metadataService]);
  const dashboards = request.data ?? [];

  const retry = () => {
    metadataService.invalidate();
    request.retry();
  };

  const handleChange = (id: string) => {
    if (id === '') {
      onChange('', '');
      return;
    }
    const found = dashboards.find(d => d.id === id);
    if (found) onChange(found.id, found.name);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <TableComboBox
        ariaLabel="Dashboard"
        noun="dashboards"
        value={value}
        onChange={handleChange}
        items={dashboards.map(d => ({ logicalName: d.id, displayName: d.name, detail: d.isPersonal ? 'Personal' : 'System' }))}
        disabled={disabled}
        loading={request.status === 'loading'}
        error={request.error ?? undefined}
        invalid={error || (request.status === 'loaded' && !!value && !dashboards.some(d => d.id === value))}
        onRetry={retry}
        placeholder="Select a dashboard…"
      />
      {request.status === 'error' && (
        <Callout type="err" icon="x">
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span>Could not load dashboards. {request.error}</span>
            <RetryButton onClick={retry} />
          </span>
        </Callout>
      )}
    </div>
  );
}
