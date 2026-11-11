export type NotifyType = 'info' | 'success' | 'warning' | 'error';

/** Best-effort host notification: a missing or failing notification API must never break the caller. */
export function notify(title: string, body: string, type: NotifyType): void {
  try {
    // The host hides a notification after the user's duration (5 s by default); 0 keeps it until dismissed.
    const persistent = type === 'error' || type === 'warning' ? { duration: 0 } : {};
    Promise.resolve(window.toolboxAPI?.utils?.showNotification({ title, body, type, ...persistent }))
      .catch(() => { /* best-effort; never mask the caller's own outcome */ });
  } catch {
    /* showNotification threw synchronously */
  }
}
