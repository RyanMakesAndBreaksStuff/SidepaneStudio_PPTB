import { PaneDefinitionConfig, RECORD_TARGETS } from '../types/PaneDefinitionConfig';
import { TRIGGER_CAPABILITIES } from './triggerCapabilities';

export type SummarySlot = 'trigger' | 'host' | 'target' | 'source' | 'pane';
export interface SummaryPart { text: string; slot?: SummarySlot; }

const or = (value: string, placeholder: string) => value.trim() || `(${placeholder})`;

function triggerPhrase(config: PaneDefinitionConfig): string {
  const { trigger, host } = config;
  switch (trigger.kind) {
    case 'FormOnLoad':     return 'a record form loads';
    case 'FormButton':     return 'a user clicks a form command button';
    case 'FormOnChange':   return `the ${or(host.attribute, 'column')} column changes`;
    case 'LookupTagClick': return `a user clicks a tag in ${host.lookupControls.length ? host.lookupControls.join(', ') : '(lookup control)'}`;
    case 'GridButton':     return 'a user clicks a command button';
    case 'GridRowSelect':  return 'a user selects a row';
    case 'ManualJS':       return 'the script runs in the console';
  }
}

/** The grid family names its surface here so the sentence reads "selects a row in the account subgrid". */
function hostPhrase(config: PaneDefinitionConfig): string | null {
  const caps = TRIGGER_CAPABILITIES[config.trigger.kind];
  if (caps.family === 'manual') return null;
  const table = or(config.host.entityName, 'table');
  if (caps.family === 'grid') {
    const grid = config.trigger.surface === 'subgrid' ? 'subgrid' : 'grid';
    return config.trigger.kind === 'GridRowSelect' ? ` in the ${table} ${grid}` : ` on the ${table} ${grid}`;
  }
  return ` on the ${table} form`;
}

function targetPhrase(config: PaneDefinitionConfig): string {
  const target = config.target;
  switch (target.pageType) {
    case 'custom':       return `custom page ${or(target.name, 'name')}`;
    case 'generative':   return `generative page ${or(target.pageId, 'page ID')}`;
    case 'entityrecord': return target.createNew ? `a new ${or(target.entityName, 'table')} record` : `the ${or(target.entityName, 'table')} record`;
    case 'entitylist':   return `the ${or(target.entityName, 'table')} list`;
    case 'webresource':  return `web resource ${or(target.name, 'name')}`;
    case 'dashboard':    return `dashboard ${or(target.dashboardName, 'dashboard')}`;
    case 'search':       return 'global search';
  }
}

function sourcePhrase(config: PaneDefinitionConfig): string | null {
  const { source } = config.context;
  if (!RECORD_TARGETS.includes(config.target.pageType) || source.kind === 'none') return null;
  const creating = config.target.pageType === 'entityrecord' && config.target.createNew === true;
  const prefix = creating ? ' pre-filled from' : ' from';
  switch (source.kind) {
    case 'host':        return `${prefix} the form record`;
    case 'selectedRow': return `${prefix} the selected row`;
    case 'clickedTag':  return ' from the clicked tag';
    case 'lookup':      return ` from the ${or(source.attribute, 'lookup')} lookup`;
    case 'fixed':       return ` with record ${or(source.id, 'GUID')}`;
    default:            return null;
  }
}

/** The configuration as one sentence; editable phrases carry a slot so the panel can jump to them. */
export function describeConfig(config: PaneDefinitionConfig): SummaryPart[] {
  const parts: SummaryPart[] = [{ text: 'When ' }, { text: triggerPhrase(config), slot: 'trigger' }];
  const host = hostPhrase(config);
  if (host) parts.push({ text: host, slot: 'host' });
  parts.push({ text: ', open ' }, { text: targetPhrase(config), slot: 'target' });
  const source = sourcePhrase(config);
  if (source) parts.push({ text: source, slot: 'source' });
  parts.push({ text: ` in a ${config.pane.width}px pane titled “${or(config.pane.title, 'title')}”`, slot: 'pane' }, { text: '.' });
  return parts;
}

export function describeConfigText(config: PaneDefinitionConfig): string {
  return describeConfig(config).map(part => part.text).join('');
}
