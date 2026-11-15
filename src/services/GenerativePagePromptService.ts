import { PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { recordContextTable } from './CodeGenerationService';
import { parseFormData } from './formData';

function dataKeys(text: string): string[] {
  try {
    return Object.keys(parseFormData(text) ?? {});
  } catch {
    return []; // ValidationService reports invalid page data.
  }
}

/**
 * Wording for the app agent. A generative page reads recordId, entityName and data only if its
 * prompt sets it up to accept them. Empty when the script sends no inputs.
 */
export function buildGenerativePagePrompt(config: PaneDefinitionConfig): string {
  if (config.target.pageType !== 'generative') return '';
  const lines: string[] = [];
  const table = recordContextTable(config);
  if (table !== null) {
    const entity = table ? `an entityName of "${table}"` : 'an entityName (a table logical name)';
    lines.push(`Set up the page to accept ${entity} and a recordId GUID. On load, fetch and display that record.`);
  }
  const keys = dataKeys(config.target.data);
  if (keys.length > 0) lines.push(`Set up the page to accept a data object with the keys ${keys.join(', ')}.`);
  return lines.join('\n');
}
