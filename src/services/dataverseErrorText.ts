/** Dataverse PrivilegeDenied (0x80040220): "... is missing prvReadaccount privilege ...". */
const MISSING_PRIVILEGE = /missing (prv\w+) privilege/i;
const PRIVILEGE_DENIED_CODE = '0x80040220';

/** r2 WR-009 — what a Dataverse failure means for the person using the tool; null when the error says nothing known. */
export function dataverseFailureHint(error: unknown): string | null {
  const status = (error as { status?: unknown } | null | undefined)?.status;
  const message = error instanceof Error ? error.message : '';
  const privilege = MISSING_PRIVILEGE.exec(message)?.[1];
  if (status === 403 || privilege || message.includes(PRIVILEGE_DENIED_CODE)) {
    const detail = privilege ? ` (missing privilege ${privilege})` : '';
    return `You do not have permission to read this in the connected environment${detail}. Ask an administrator to add it to your security role.`;
  }
  if (status === 401) return 'Your sign-in to this environment has expired. Reconnect it in Power Platform ToolBox, then retry.';
  if (status === 404) return 'Not found in the connected environment.';
  if (status === 429) return 'Dataverse is limiting requests right now. Wait a moment, then retry.';
  return null;
}

/** The hint when one applies, else the error's own message, else `fallback`. */
export function describeDataverseError(error: unknown, fallback: string): string {
  return dataverseFailureHint(error) ?? (error instanceof Error ? error.message : fallback);
}
