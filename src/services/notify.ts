export type NotifyType = 'info' | 'success' | 'warning' | 'error';

/** Best-effort host notification: a missing or failing notification API must never break the caller. */
export function notify(title: string, body: string, type: NotifyType): void {
  try {
    Promise.resolve(window.toolboxAPI?.utils?.showNotification({ title, body, type }))
      .catch(() => { /* best-effort; never mask the caller's own outcome */ });
  } catch {
    /* showNotification threw synchronously */
  }
}
