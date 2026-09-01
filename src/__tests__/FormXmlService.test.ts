import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FormXmlService } from '../services/FormXmlService';
import { escapeODataStringLiteral } from '../services/odataGuards';
import type { IXrmContext } from '../adapters/PptbContextAdapter';
import { xrmStub } from './testHelpers';

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

function makeXrm(forms: object[] = [], formXml = MINIMAL_FORM_XML): IXrmContext {
  return {
    ...xrmStub(),
    webApiGet: vi.fn().mockResolvedValue(forms),
    webApiGetEntity: vi.fn().mockResolvedValue({ formxml: formXml }),
  };
}

describe('FormXmlService', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('getFormsForEntityResult returns ok with form metadata', async () => {
    const xrm = makeXrm([{ formid: 'f1', name: 'Main Form' }]);
    const svc = new FormXmlService(xrm);
    const result = await svc.getFormsForEntityResult('account');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.forms).toHaveLength(1);
      expect(result.forms[0].id).toBe('f1');
      expect(result.forms[0].name).toBe('Main Form');
    }
  });

  it('getFormsForEntityResult rejects invalid logical names before querying Dataverse', async () => {
    const xrm = makeXrm();
    const svc = new FormXmlService(xrm);

    const result = await svc.getFormsForEntityResult("account' or type eq 1");

    expect(result.ok).toBe(false);
    expect(xrm.webApiGet).not.toHaveBeenCalled();
  });

  it('escapes single quotes in OData string literals', () => {
    expect(escapeODataStringLiteral("account's")).toBe("account''s");
  });

  it('getFormsForEntityResult returns empty forms array when ok', async () => {
    const xrm = makeXrm([]);
    const svc = new FormXmlService(xrm);
    const result = await svc.getFormsForEntityResult('noentity');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.forms).toEqual([]);
    }
  });

  it('getFormModelResult returns ok with parsed model', async () => {
    const xrm = makeXrm([], MINIMAL_FORM_XML);
    const svc = new FormXmlService(xrm);
    const result = await svc.getFormModelResult('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.model.tabs).toHaveLength(1);
      expect(result.model.tabs[0].label).toBe('General');
      expect(result.model.tabs[0].sections).toHaveLength(1);
      expect(result.model.tabs[0].sections[0].columnCount).toBe(2);
      expect(result.model.tabs[0].sections[0].rows[0].cells).toHaveLength(2);
      expect(result.model.tabs[0].sections[0].rows[0].cells[0].label).toBe('Name');
      expect(result.model.tabs[0].sections[0].rows[0].cells[0].fieldName).toBe('name');
      expect(result.model.tabs[0].sections[0].rows[0].cells[0].fieldType).toBe('text');
    }
  });

  it('getFormModelResult normalizes valid form IDs before querying Dataverse', async () => {
    const xrm = makeXrm([], MINIMAL_FORM_XML);
    const svc = new FormXmlService(xrm);

    const result = await svc.getFormModelResult('{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}');

    expect(result.ok).toBe(true);
    expect(xrm.webApiGetEntity).toHaveBeenCalledWith('systemforms(aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee)?$select=formxml');
  });

  it('getFormModelResult rejects invalid form IDs before querying Dataverse', async () => {
    const xrm = makeXrm();
    const svc = new FormXmlService(xrm);

    const result = await svc.getFormModelResult('not-a-guid');

    expect(result.ok).toBe(false);
    expect(xrm.webApiGetEntity).not.toHaveBeenCalled();
  });

  it('getFormModelResult returns error when XML is malformed', async () => {
    const xrm = makeXrm([], 'NOT_XML<<<');
    const svc = new FormXmlService(xrm);
    const result = await svc.getFormModelResult('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid-formxml');
    }
  });

  it('getFormModelResult returns error when webApiGetEntity throws', async () => {
    const xrm: IXrmContext = {
      ...xrmStub(),
      webApiGetEntity: vi.fn().mockRejectedValue(new Error('Network error')),
    };
    const svc = new FormXmlService(xrm);
    const result = await svc.getFormModelResult('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('query-failed');
    }
  });

  it('queries through the injected context, not window.dataverseAPI', async () => {
    const queryData = vi.fn();
    vi.stubGlobal('dataverseAPI', { queryData });

    const xrm = {
      webApiGet: vi.fn().mockResolvedValue([{ formid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', name: 'Main' }]),
      webApiGetEntity: vi.fn().mockResolvedValue({ formxml: MINIMAL_FORM_XML }),
    } as unknown as IXrmContext;

    const svc = new FormXmlService(xrm);

    const forms = await svc.getFormsForEntityResult('account');
    expect(forms.ok).toBe(true);

    const model = await svc.getFormModelResult('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(model.ok).toBe(true);

    expect(xrm.webApiGet).toHaveBeenCalledTimes(1);
    expect(xrm.webApiGetEntity).toHaveBeenCalledTimes(1);
    expect(queryData).not.toHaveBeenCalled();
  });
});
