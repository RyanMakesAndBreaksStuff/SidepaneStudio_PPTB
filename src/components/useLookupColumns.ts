import { displayLabel, type LookupAttributeInfo, type MetadataService } from '../services/MetadataService';
import { useMetadataRequest, type MetadataRequest, type PickerStatus } from './useMetadataRequest';

export function lookupLabel(lookup: LookupAttributeInfo): string {
  const label = displayLabel(lookup);
  return label === lookup.LogicalName ? label : `${label} (${lookup.LogicalName})`;
}

export interface LookupColumns {
  request: MetadataRequest<LookupAttributeInfo[]>;
  /** The lookup columns sorted by label; null until the request has loaded. */
  loaded: LookupAttributeInfo[] | null;
  find: (logicalName: string) => LookupAttributeInfo | undefined;
  /** What the saved column amounts to once the request settles: resolved, unavailable on this table, or the table has none. */
  statusFor: (logicalName: string) => PickerStatus;
}

/** Lookup columns on `entityName`; an empty name loads nothing. The owner of a lookup choice calls this and hands the result to `LookupPicker`. */
export function useLookupColumns(metadataService: Pick<MetadataService, 'listLookupAttributes'>, entityName: string): LookupColumns {
  const request = useMetadataRequest(
    entityName
      ? () => metadataService.listLookupAttributes(entityName)
        .then(lookups => [...lookups].sort((a, b) => lookupLabel(a).localeCompare(lookupLabel(b))))
      : null,
    [metadataService, entityName],
  );
  const loaded = request.data;
  const find = (logicalName: string) => loaded?.find(lookup => lookup.LogicalName === logicalName);
  const statusFor = (logicalName: string): PickerStatus => request.status !== 'loaded' ? request.status
    : logicalName && !find(logicalName) ? 'unavailable'
      : loaded?.length === 0 ? 'empty'
        : 'resolved';
  return { request, loaded, find, statusFor };
}
