export function parseFormData(text: string): Record<string, unknown> | undefined {
  if (!text.trim()) return undefined;
  const value: unknown = JSON.parse(text);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Form data must be a JSON object.');
  }
  return value as Record<string, unknown>;
}