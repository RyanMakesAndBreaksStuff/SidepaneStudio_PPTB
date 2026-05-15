// src/services/FormXmlService.ts

export interface FormMeta {
  id: string;
  name: string;
}

export interface FormModel {
  tabs: FormTab[];
}

export interface FormTab {
  name: string;
  label: string;
  expanded: boolean;
  sections: FormSection[];
}

export interface FormSection {
  name: string;
  label: string;
  showLabel: boolean;
  columnCount: number;
  rows: FormRow[];
}

export interface FormRow {
  cells: FormCell[];
}

export interface FormCell {
  label: string;
  fieldName: string;
  fieldType: 'text' | 'memo' | 'lookup' | 'datetime' | 'boolean' | 'picklist' | 'number' | 'currency' | 'unknown';
  colspan: number;
  empty: boolean;
}

// Partial classId prefix (first 8 hex chars, lower) → field type
// Stable GUIDs across all Dynamics 365 environments
const CLASSID_FIELD_TYPE: Record<string, FormCell['fieldType']> = {
  '4273edbd': 'text',      // SingleLine.Text
  'c3efe0c3': 'memo',      // MultiLine.Text
  '67fac785': 'lookup',    // Lookup
  '5d68b988': 'datetime',  // DateTime
  'b0c6723a': 'boolean',   // TwoOptions
  '3ef39988': 'picklist',  // OptionSet
  'aa987274': 'number',    // Integer
  'c6d124ca': 'number',    // Decimal / Float
  '060f0b88': 'lookup',    // Customer
  '71716b6c': 'currency',  // Money / Currency
};

function classIdToFieldType(classId: string): FormCell['fieldType'] {
  const prefix = classId.toLowerCase().replace(/[{}]/g, '').substring(0, 8);
  return CLASSID_FIELD_TYPE[prefix] ?? 'unknown';
}

function firstLabel(el: Element | null): string {
  if (!el) return '';
  return el.querySelector('labels > label')?.getAttribute('description') ?? '';
}

export class FormXmlService {
  async getFormsForEntity(entityLogicalName: string): Promise<FormMeta[]> {
    try {
      const result = await window.dataverseAPI.queryData(
        `systemforms?$filter=objecttypecode eq '${entityLogicalName}' and type eq 2` +
          `&$select=name,formid&$orderby=name asc`
      );
      return (result.value ?? []).map((f: any) => ({ id: f.formid, name: f.name }));
    } catch {
      return [];
    }
  }

  async getFormModel(formId: string): Promise<FormModel | null> {
    try {
      const result = await window.dataverseAPI.queryData(
        `systemforms(${formId})?$select=formxml`
      ) as unknown as Record<string, unknown>;
      return this._parseFormXml((result.formxml as string) ?? '');
    } catch {
      return null;
    }
  }

  private _parseFormXml(xml: string): FormModel | null {
    try {
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      if (doc.querySelector('parsererror')) return null;

      const tabs: FormTab[] = [];
      for (const tabEl of Array.from(doc.querySelectorAll('form > tabs > tab'))) {
        const sections: FormSection[] = [];
        for (const sectionEl of Array.from(tabEl.querySelectorAll('sections > section'))) {
          const rows: FormRow[] = [];
          for (const rowEl of Array.from(sectionEl.querySelectorAll('rows > row'))) {
            const cells: FormCell[] = [];
            for (const cellEl of Array.from(rowEl.querySelectorAll('cell'))) {
              const controlEl = cellEl.querySelector('control');
              const isEmpty = !controlEl;
              const classId = controlEl?.getAttribute('classid') ?? '';
              cells.push({
                label: firstLabel(cellEl),
                fieldName: controlEl?.getAttribute('datafieldname') ?? '',
                fieldType: isEmpty ? 'unknown' : classIdToFieldType(classId),
                colspan: parseInt(cellEl.getAttribute('colspan') ?? '1', 10),
                empty: isEmpty,
              });
            }
            rows.push({ cells });
          }
          sections.push({
            name: sectionEl.getAttribute('name') ?? '',
            label: firstLabel(sectionEl),
            showLabel: sectionEl.getAttribute('showlabel') !== 'false',
            columnCount: parseInt(sectionEl.getAttribute('columns') ?? '1', 10),
            rows,
          });
        }
        tabs.push({
          name: tabEl.getAttribute('name') ?? '',
          label: firstLabel(tabEl),
          expanded: tabEl.getAttribute('expanded') !== 'false',
          sections,
        });
      }
      return { tabs };
    } catch {
      return null;
    }
  }
}
