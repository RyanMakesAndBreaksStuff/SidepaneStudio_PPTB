// src/services/FormXmlService.ts
import {
  buildSystemFormXmlPath,
  buildSystemFormsForEntityPath,
  isValidLogicalName,
} from './odataGuards';
import type { IXrmContext } from '../adapters/PptbContextAdapter';

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

export type FormServiceErrorCode =
  | 'invalid-entity-logical-name'
  | 'invalid-form-id'
  | 'query-failed'
  | 'missing-formxml'
  | 'invalid-formxml';

export interface FormServiceError {
  code: FormServiceErrorCode;
  message: string;
  cause?: unknown;
}

export type FormsForEntityResult =
  | { ok: true; forms: FormMeta[] }
  | { ok: false; error: FormServiceError };

export type FormModelResult =
  | { ok: true; model: FormModel }
  | { ok: false; error: FormServiceError };

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

/** The element's own label in the user's language, else its first label. */
function labelOf(el: Element | null, languageCode: number | null): string {
  const labels = Array.from(el?.children ?? []).find(child => child.tagName === 'labels');
  const all = Array.from(labels?.children ?? []).filter(child => child.tagName === 'label');
  const match = languageCode === null ? undefined : all.find(label => label.getAttribute('languagecode') === String(languageCode));
  return (match ?? all[0])?.getAttribute('description') ?? '';
}

export class FormXmlService {
  constructor(private readonly xrm: IXrmContext, private readonly userLanguageCode: () => number | null | undefined = () => null) {}

  async getFormsForEntityResult(entityLogicalName: string): Promise<FormsForEntityResult> {
    if (!isValidLogicalName(entityLogicalName)) {
      return {
        ok: false,
        error: {
          code: 'invalid-entity-logical-name',
          message: `Invalid entity logical name: ${entityLogicalName}`,
        },
      };
    }

    try {
      const rows = await this.xrm.webApiGet<Array<Record<string, unknown>>>(
        buildSystemFormsForEntityPath(entityLogicalName)
      );
      return {
        ok: true,
        forms: (rows ?? []).map((form) => ({ id: String(form.formid ?? ''), name: String(form.name ?? '') })),
      };
    } catch (cause) {
      return {
        ok: false,
        error: {
          code: 'query-failed',
          message: 'Failed to load forms for entity.',
          cause,
        },
      };
    }
  }

  async getFormModelResult(formId: string): Promise<FormModelResult> {
    const path = buildSystemFormXmlPath(formId);
    if (!path) {
      return {
        ok: false,
        error: {
          code: 'invalid-form-id',
          message: `Invalid form ID: ${formId}`,
        },
      };
    }

    try {
      const result = await this.xrm.webApiGetEntity<Record<string, unknown>>(path);
      if (typeof result.formxml !== 'string') {
        return {
          ok: false,
          error: {
            code: 'missing-formxml',
            message: 'The form XML response did not include formxml.',
          },
        };
      }

      const model = this._parseFormXml(result.formxml);
      if (!model) {
        return {
          ok: false,
          error: {
            code: 'invalid-formxml',
            message: 'The form XML response could not be parsed.',
          },
        };
      }

      return { ok: true, model };
    } catch (cause) {
      return {
        ok: false,
        error: {
          code: 'query-failed',
          message: 'Failed to load form XML.',
          cause,
        },
      };
    }
  }

  private _parseFormXml(xml: string): FormModel | null {
    try {
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      if (doc.querySelector('parsererror')) return null;
      const code = this.userLanguageCode();
      const languageCode = typeof code === 'number' ? code : null;

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
                label: labelOf(cellEl, languageCode),
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
            label: labelOf(sectionEl, languageCode),
            showLabel: sectionEl.getAttribute('showlabel') !== 'false',
            columnCount: parseInt(sectionEl.getAttribute('columns') ?? '1', 10),
            rows,
          });
        }
        tabs.push({
          name: tabEl.getAttribute('name') ?? '',
          label: labelOf(tabEl, languageCode),
          sections,
        });
      }
      return { tabs };
    } catch {
      return null;
    }
  }
}
