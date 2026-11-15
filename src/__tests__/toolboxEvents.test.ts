import { describe, expect, it, vi } from 'vitest';
import { subscribeToolboxEvents } from '../adapters/toolboxEvents';

describe('subscribeToolboxEvents', () => {
  it('unsubscribes with the disposer events.on returns, not with off', () => {
    const dispose = vi.fn();
    const events = { on: vi.fn(() => dispose), off: vi.fn() };
    const handler = vi.fn();
    const unsubscribe = subscribeToolboxEvents(events, handler);
    expect(events.on).toHaveBeenCalledWith(handler);
    unsubscribe();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(events.off).not.toHaveBeenCalled();
  });

  it('falls back to off when events.on returns nothing', () => {
    const events = { on: vi.fn(), off: vi.fn() };
    const handler = vi.fn();
    subscribeToolboxEvents(events, handler)();
    expect(events.off).toHaveBeenCalledWith(handler);
  });
});
