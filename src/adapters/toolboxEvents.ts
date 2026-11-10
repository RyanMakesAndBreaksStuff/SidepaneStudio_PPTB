/**
 * Subscribes `handler` to host events and returns the matching unsubscribe.
 * PPTB Desktop's preload wraps the callback, so `events.off(handler)` never finds it; only the disposer
 * that `events.on` returns at runtime removes the listener (@pptb/types types that return as `void`).
 * A host that returns nothing falls back to `off`.
 */
export function subscribeToolboxEvents(
  events: Pick<ToolBoxAPI.EventsAPI, 'on' | 'off'>,
  handler: (event: unknown, payload?: ToolBoxAPI.ToolBoxEventPayload) => void,
): () => void {
  const disposer: unknown = events.on(handler);
  if (typeof disposer === 'function') return () => { disposer(); };
  return () => { events.off(handler); };
}
