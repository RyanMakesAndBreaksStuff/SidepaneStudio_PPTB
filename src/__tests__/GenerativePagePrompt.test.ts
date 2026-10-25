import { describe, expect, it } from 'vitest';
import { buildGenerativePagePrompt } from '../services/GenerativePagePromptService';
import type { PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { cfg } from './testHelpers';

const page = (data: string, context: Partial<PaneDefinitionConfig['context']> = {}, trigger: Partial<PaneDefinitionConfig['trigger']> = {}) => cfg({
  trigger: { kind: 'FormButton', ...trigger },
  target: { pageType: 'generative', pageId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', data },
  context: { mode: 'None', entityName: '', ...context },
});

describe('buildGenerativePagePrompt', () => {
  it('is empty when the script sends no inputs', () => {
    expect(buildGenerativePagePrompt(page(''))).toBe('');
  });

  it('asks for the record table and ID when a record is sent', () => {
    expect(buildGenerativePagePrompt(page('', { mode: 'CurrentRecord', entityName: 'account' }))).toBe(
      'Set up the page to accept an entityName of "account" and a recordId GUID. On load, fetch and display that record.');
  });

  it('lists the data keys when only data is sent', () => {
    expect(buildGenerativePagePrompt(page('{"status":"open","category":2}'))).toBe(
      'Set up the page to accept a data object with the keys status, category.');
  });

  it('combines both, leaving the table open when it is chosen at runtime', () => {
    expect(buildGenerativePagePrompt(page('{"status":"open"}', {}, { kind: 'LookupTagClick', fieldName: 'parentcustomerid' }))).toBe(
      'Set up the page to accept an entityName (a table logical name) and a recordId GUID. On load, fetch and display that record.\n' +
      'Set up the page to accept a data object with the keys status.');
  });

  it('ignores page data that is not a JSON object', () => {
    expect(buildGenerativePagePrompt(page('[1]'))).toBe('');
  });
});
