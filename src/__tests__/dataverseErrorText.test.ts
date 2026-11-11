import { describe, expect, it } from 'vitest';
import { DataverseError } from '../adapters/PptbContextAdapter';
import { MetadataService } from '../services/MetadataService';
import { dataverseFailureHint, describeDataverseError } from '../services/dataverseErrorText';

const DENIED = 'You do not have permission to read this in the connected environment';
const ASK = 'Ask an administrator to add it to your security role.';

describe('dataverseFailureHint (r2 WR-009)', () => {
  it('explains an HTTP 403', () => {
    expect(dataverseFailureHint(new DataverseError('Forbidden', 403))).toBe(`${DENIED}. ${ASK}`);
  });

  it('names the missing privilege from a PrivilegeDenied message that carries no HTTP status', () => {
    const error = new Error('Dataverse fetchXmlQuery failed: 0x80040220: Principal user (Id=1) is missing prvReadbotcomponent privilege');
    expect(dataverseFailureHint(error)).toBe(`${DENIED} (missing privilege prvReadbotcomponent). ${ASK}`);
  });

  it.each([
    [401, 'Your sign-in to this environment has expired. Reconnect it in Power Platform ToolBox, then retry.'],
    [404, 'Not found in the connected environment.'],
    [429, 'Dataverse is limiting requests right now. Wait a moment, then retry.'],
  ])('explains an HTTP %s', (status, text) => {
    expect(dataverseFailureHint(new DataverseError('x', status))).toBe(text);
  });

  it('says nothing about a failure it does not recognise', () => {
    expect(dataverseFailureHint(new Error('Network error'))).toBeNull();
    expect(dataverseFailureHint(new DataverseError('Server Error', 500))).toBeNull();
  });
});

describe('describeDataverseError (r2 WR-009)', () => {
  it('prefers the hint, then the message, then the fallback', () => {
    expect(describeDataverseError(new DataverseError('Forbidden', 403), 'fallback')).toBe(`${DENIED}. ${ASK}`);
    expect(describeDataverseError(new Error('Network error'), 'fallback')).toBe('Network error');
    expect(describeDataverseError('not an error', 'fallback')).toBe('fallback');
  });

  it('reaches the table picker through MetadataService', async () => {
    const webApiGet = async () => { throw new Error('queryData failed: 0x80040220: Principal user (Id=1) is missing prvReadEntity privilege'); };
    expect(await new MetadataService({ webApiGet }).listAccessibleTables()).toEqual({
      status: 'error', reason: `${DENIED} (missing privilege prvReadEntity). ${ASK}`,
    });
  });
});
