import { describe, expect, it, vi } from 'vitest';
import { capGridFetchXml, parseGridFetch, resolveGridColumns } from '../services/GridViewModel';

const cap = (xml: string, lookup = '') => capGridFetchXml(parseGridFetch(xml, 'account'), lookup);

describe('capGridFetchXml', () => {
  it('caps the root while preserving filters, joins, ordering and smaller limits', () => {
    const xml = '<?xml version="1.0"?><fetch top="25" count="200" page="2" paging-cookie="cookie" returntotalrecordcount="true"><entity name="account"><filter><condition attribute="name" operator="eq" value="A &amp; B"/></filter><order attribute="name"/><link-entity name="contact" from="parentcustomerid" to="accountid" alias="c"/></entity></fetch>';
    const doc = new DOMParser().parseFromString(cap(xml), 'text/xml');
    expect(doc.documentElement.getAttribute('top')).toBe('10');
    for (const key of ['count', 'page', 'paging-cookie', 'returntotalrecordcount']) expect(doc.documentElement.hasAttribute(key)).toBe(false);
    expect(doc.querySelector('condition')?.getAttribute('value')).toBe('A & B');
    expect(doc.querySelector('link-entity')?.getAttribute('alias')).toBe('c');
    expect(doc.querySelector('order')?.getAttribute('attribute')).toBe('name');
    expect(cap('<fetch top="3"><entity name="account"/></fetch>')).toContain('top="3"');
  });

  it('rejects invalid FetchXML and row limits', () => {
    for (const bad of ['<fetch>', '<fetch><entity name="contact"/></fetch>', '<!DOCTYPE fetch><fetch><entity name="account"/></fetch>',
      '<fetch><entity name="account"/><entity name="account"/></fetch>']) {
      expect(() => cap(bad), bad).toThrow('valid FetchXML for the preview entity');
    }
    expect(() => cap('<fetch top="oops"><entity name="account"/></fetch>')).toThrow('row limit');
  });

  it('adds a RelatedRecord lookup column once, and never beside all-attributes', () => {
    const attributes = (xml: string) => Array.from(new DOMParser().parseFromString(xml, 'text/xml')
      .querySelectorAll('entity > attribute')).map(a => a.getAttribute('name'));
    expect(attributes(cap('<fetch><entity name="account"><attribute name="name"/></entity></fetch>', 'primarycontactid')))
      .toEqual(['name', 'primarycontactid']);
    expect(attributes(cap('<fetch><entity name="account"><attribute name="primarycontactid"/></entity></fetch>', 'primarycontactid')))
      .toEqual(['primarycontactid']);
    expect(cap('<fetch><entity name="account"><all-attributes/></entity></fetch>', 'primarycontactid'))
      .not.toContain('<attribute');
  });

  it('leaves the parsed document unchanged so column resolution sees the original view', async () => {
    const parsed = parseGridFetch('<fetch><entity name="account"><attribute name="name"/></entity></fetch>', 'account');
    capGridFetchXml(parsed, 'primarycontactid');
    expect(parsed.doc.documentElement.hasAttribute('top')).toBe(false);
    expect(parsed.entity.querySelectorAll('attribute')).toHaveLength(1);
    const view = { id: 'v', name: 'V', viewType: 'savedquery' as const,
      fetchXml: '<fetch><entity name="account"><attribute name="name"/></entity></fetch>',
      layoutXml: '<grid><row><cell name="primarycontactid"/></row></grid>' };
    const metadata = { listAttributeLabels: vi.fn().mockResolvedValue([]) };
    await expect(resolveGridColumns(view, 'account', metadata, parsed)).rejects.toThrow('cannot be resolved');
  });
});
