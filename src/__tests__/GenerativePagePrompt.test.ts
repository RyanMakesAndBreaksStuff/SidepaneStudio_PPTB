import { describe, expect, it } from 'vitest';
import { recordContextTable } from '../services/CodeGenerationService';
import { buildGenerativePagePrompt } from '../services/GenerativePagePromptService';
import type { PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { cfg } from './testHelpers';

const page = (
  data: string,
  context: Partial<PaneDefinitionConfig['context']> = { source: { kind: 'none' } },
  trigger: Partial<PaneDefinitionConfig['trigger']> = {},
  host: Partial<PaneDefinitionConfig['host']> = {},
) => cfg({
  trigger: { kind: 'FormButton', ...trigger },
  host,
  target: { pageType: 'generative', pageId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', data },
  context,
});

describe('buildGenerativePagePrompt', () => {
  it('is empty when the script sends no inputs', () => {
    expect(buildGenerativePagePrompt(page(''))).toBe('');
  });

  it('asks for the record table and ID when a record is sent', () => {
    expect(buildGenerativePagePrompt(page('', { source: { kind: 'host' } }, {}, { entityName: 'account' }))).toBe(
      'Set up the page to accept an entityName of "account" and a recordId GUID. On load, fetch and display that record.');
  });

  it('lists the data keys when only data is sent', () => {
    expect(buildGenerativePagePrompt(page('{"status":"open","category":2}'))).toBe(
      'Set up the page to accept a data object with the keys status, category.');
  });

  it('combines both, leaving the table open when it is chosen at runtime', () => {
    expect(buildGenerativePagePrompt(page('{"status":"open"}', { source: { kind: 'clickedTag' } }, { kind: 'LookupTagClick' }, { lookupControls: ['parentcustomerid'] }))).toBe(
      'Set up the page to accept an entityName (a table logical name) and a recordId GUID. On load, fetch and display that record.\n' +
      'Set up the page to accept a data object with the keys status.');
  });

  it('ignores page data that is not a JSON object', () => {
    expect(buildGenerativePagePrompt(page('[1]'))).toBe('');
  });
});

describe('recordContextTable', () => {
  it('returns a known logical name for a host source with a host table', () => {
    expect(recordContextTable(page('', { source: { kind: 'host' } }, {}, { entityName: 'account' }))).toBe('account');
  });

  it('returns an empty string for a host source without a host table', () => {
    expect(recordContextTable(page('', { source: { kind: 'host' } }))).toBe('');
  });

  it('returns an empty string for a runtime clicked-tag or lookup table', () => {
    expect(recordContextTable(page('', { source: { kind: 'clickedTag' } }, { kind: 'LookupTagClick' }, { lookupControls: ['parentcustomerid'] }))).toBe('');
    expect(recordContextTable(page('', {
      source: { kind: 'lookup', attribute: 'parentcustomerid' },
    }, {}, { entityName: 'account' }))).toBe('');
  });

  it('returns null when no record pair is sent', () => {
    expect(recordContextTable(page('', { source: { kind: 'none' } }, {}, { entityName: 'account' }))).toBeNull();
  });
});
