import * as React from 'react';

export interface TabStripItem<T extends string> {
  id: T;
  label: string;
}

export interface TabStripProps<T extends string> {
  /** Accessible name of the tab list. */
  label: string;
  tabs: readonly TabStripItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Shared with `tabPanelProps` on the element that shows the selected tab; omit when no single element does. */
  idPrefix?: string;
  style?: React.CSSProperties;
  tabStyle: (active: boolean) => React.CSSProperties;
}

/** Props for the element that shows the selected tab's content. */
export function tabPanelProps(idPrefix: string, selected: string): { role: 'tabpanel'; id: string; 'aria-labelledby': string } {
  return { role: 'tabpanel', id: `${idPrefix}-panel`, 'aria-labelledby': `${idPrefix}-tab-${selected}` };
}

/**
 * The one tab strip (r2 WR-011). Keyboard follows the ARIA tabs pattern with automatic activation: one Tab stop,
 * and Left, Right, Home and End move both focus and selection.
 */
export function TabStrip<T extends string>({ label, tabs, value, onChange, idPrefix, style, tabStyle }: TabStripProps<T>): React.ReactElement {
  const at = tabs.findIndex(tab => tab.id === value);
  const stop = at < 0 ? 0 : at;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const to = event.key === 'ArrowRight' ? (stop + 1) % tabs.length
      : event.key === 'ArrowLeft' ? (stop - 1 + tabs.length) % tabs.length
        : event.key === 'Home' ? 0
          : event.key === 'End' ? tabs.length - 1 : -1;
    if (to < 0 || to === at) return;
    event.preventDefault();
    onChange(tabs[to].id);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[to]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} style={style}>
      {tabs.map((tab, index) => {
        const active = index === at;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={idPrefix ? `${idPrefix}-tab-${tab.id}` : undefined}
            aria-selected={active}
            aria-controls={idPrefix && active ? `${idPrefix}-panel` : undefined}
            tabIndex={index === stop ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={handleKeyDown}
            style={tabStyle(active)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
