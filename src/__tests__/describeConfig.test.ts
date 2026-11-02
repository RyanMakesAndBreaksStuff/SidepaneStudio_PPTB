import { describe, expect, it } from 'vitest';
import { describeConfig, describeConfigText } from '../services/describeConfig';
import { cfg } from './testHelpers';

describe('describeConfig', () => {
  it('reads the default config as one sentence', () => {
    expect(describeConfigText(cfg())).toBe('When a user clicks a form command button on the (table) form, open custom page sps_SidePaneBuilderPage from the form record in a 480px pane titled “Related Records”.');
  });

  it('names the host, surface, lookup and new-record cases', () => {
    expect(describeConfigText(cfg({ trigger: { kind: 'GridRowSelect', surface: 'subgrid' }, host: { entityName: 'account' },
      target: { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '' }, context: { source: { kind: 'lookup', attribute: 'primarycontactid' } } })))
      .toContain('When a user selects a row in the account subgrid, open the contact record from the primarycontactid lookup');
    expect(describeConfigText(cfg({ target: { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '', createNew: true }, context: { source: { kind: 'host' } } })))
      .toContain('open a new contact record pre-filled from the form record');
    expect(describeConfigText(cfg({ trigger: { kind: 'ManualJS' }, target: { pageType: 'dashboard', dashboardId: 'd', dashboardName: 'Sales' }, context: { source: { kind: 'none' } } })))
      .toBe('When the script runs in the console, open dashboard Sales in a 480px pane titled “Related Records”.');
  });

  it('tags every editable phrase with its slot', () => {
    expect(describeConfig(cfg()).filter(part => part.slot).map(part => part.slot)).toEqual(['trigger', 'host', 'target', 'source', 'pane']);
  });
});
