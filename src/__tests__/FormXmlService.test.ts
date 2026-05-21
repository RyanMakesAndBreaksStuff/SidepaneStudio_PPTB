import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FormXmlService } from '../services/FormXmlService';
import { escapeODataStringLiteral } from '../services/odataGuards';

const MINIMAL_FORM_XML = `
<form>
  <tabs>
    <tab name="tab_general" expanded="true">
      <labels><label description="General" languagecode="1033"/></labels>
      <columns>
        <column width="100%">
          <sections>
            <section name="sec_info" showlabel="true" columns="2">
              <labels><label description="Info"/></labels>
              <rows>
                <row>
                  <cell showlabel="true" colspan="1">
                    <labels><label description="Name"/></labels>
                    <control datafieldname="name" classid="{4273EDBD-AC1D-4784-AC51-54A6FBFF39F7}" disabled="false"/>
                  </cell>
                  <cell showlabel="true" colspan="1">
                    <labels><label description="Phone"/></labels>
                    <control datafieldname="telephone1" classid="{4273EDBD-AC1D-4784-AC51-54A6FBFF39F7}" disabled="false"/>
                  </cell>
                </row>
              </rows>
            </section>
          </sections>
        </column>
      </columns>
    </tab>
  </tabs>
</form>`.trim();

function makeApi(forms: object[] = [], formXml = MINIMAL_FORM_XML) {
  return {
    queryData: vi.fn().mockImplementation((path: string) => {
      if (path === 'systemforms(aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee)?$select=formxml') {
        return Promise.resolve({ formxml: formXml });
      }
      if (
        path ===
        "systemforms?$filter=objecttypecode eq 'account' and type eq 2&$select=name,formid&$orderby=name asc"
      ) {
        return Promise.resolve({ value: forms });
      }
      if (
        path ===
        "systemforms?$filter=objecttypecode eq 'noentity' and type eq 2&$select=name,formid&$orderby=name asc"
      ) {
        return Promise.resolve({ value: forms });
      }
      if (
        path ===
        "systemforms?$filter=objecttypecode eq 'account''s' and type eq 2&$select=name,formid&$orderby=name asc"
      ) {
        return Promise.resolve({ value: forms });
      }
      if (path === 'systemforms(form-id-1)?$select=formxml' || path === 'systemforms(bad-id)?$select=formxml') {
        return Promise.resolve({ formxml: formXml });
      }
      if (path === 'systemforms(x)?$select=formxml') {
        return Promise.resolve({ formxml: formXml });
      }
      throw new Error(`Unexpected Dataverse path: ${path}`);
    }),
  };
}

describe('FormXmlService', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('getFormsForEntity returns list of form metadata', async () => {
    vi.stubGlobal('dataverseAPI', makeApi([{ formid: 'f1', name: 'Main Form' }]));
    const svc = new FormXmlService();
    const forms = await svc.getFormsForEntity('account');
    expect(forms).toHaveLength(1);
    expect(forms[0].id).toBe('f1');
    expect(forms[0].name).toBe('Main Form');
  });

  it('getFormsForEntityResult rejects invalid logical names before querying Dataverse', async () => {
    const api = makeApi();
    vi.stubGlobal('dataverseAPI', api);
    const svc = new FormXmlService();

    const result = await svc.getFormsForEntityResult("account' or type eq 1");

    expect(result.ok).toBe(false);
    expect(api.queryData).not.toHaveBeenCalled();
  });

  it('escapes single quotes in OData string literals', () => {
    expect(escapeODataStringLiteral("account's")).toBe("account''s");
  });

  it('getFormsForEntity returns empty array when none found', async () => {
    vi.stubGlobal('dataverseAPI', makeApi([]));
    const svc = new FormXmlService();
    const forms = await svc.getFormsForEntity('noentity');
    expect(forms).toEqual([]);
  });

  it('getFormModel parses tabs, sections, rows and cells', async () => {
    vi.stubGlobal('dataverseAPI', makeApi([], MINIMAL_FORM_XML));
    const svc = new FormXmlService();
    const model = await svc.getFormModel('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(model).not.toBeNull();
    expect(model!.tabs).toHaveLength(1);
    expect(model!.tabs[0].label).toBe('General');
    expect(model!.tabs[0].sections).toHaveLength(1);
    expect(model!.tabs[0].sections[0].columnCount).toBe(2);
    expect(model!.tabs[0].sections[0].rows[0].cells).toHaveLength(2);
    expect(model!.tabs[0].sections[0].rows[0].cells[0].label).toBe('Name');
    expect(model!.tabs[0].sections[0].rows[0].cells[0].fieldName).toBe('name');
    expect(model!.tabs[0].sections[0].rows[0].cells[0].fieldType).toBe('text');
  });

  it('getFormModelResult normalizes valid form IDs before querying Dataverse', async () => {
    const api = makeApi([], MINIMAL_FORM_XML);
    vi.stubGlobal('dataverseAPI', api);
    const svc = new FormXmlService();

    const result = await svc.getFormModelResult('{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}');

    expect(result.ok).toBe(true);
    expect(api.queryData).toHaveBeenCalledWith('systemforms(aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee)?$select=formxml');
  });

  it('getFormModelResult rejects invalid form IDs before querying Dataverse', async () => {
    const api = makeApi();
    vi.stubGlobal('dataverseAPI', api);
    const svc = new FormXmlService();

    const result = await svc.getFormModelResult('not-a-guid');

    expect(result.ok).toBe(false);
    expect(api.queryData).not.toHaveBeenCalled();
  });

  it('getFormModel returns null when XML is malformed', async () => {
    vi.stubGlobal('dataverseAPI', {
      queryData: vi.fn().mockResolvedValue({ formxml: 'NOT_XML<<<' }),
    });
    const svc = new FormXmlService();
    const model = await svc.getFormModel('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(model).toBeNull();
  });

  it('getFormModel returns null when queryData throws', async () => {
    vi.stubGlobal('dataverseAPI', {
      queryData: vi.fn().mockRejectedValue(new Error('Network error')),
    });
    const svc = new FormXmlService();
    const model = await svc.getFormModel('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(model).toBeNull();
  });
});
