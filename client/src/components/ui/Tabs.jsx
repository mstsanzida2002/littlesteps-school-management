import { createContext, useContext, useId } from 'react';

import { cn } from '../../utils/cn.js';

const TabsContext = createContext(null);

/**
 * ARIA tabs with automatic activation: ←/→ move and select, Home/End jump. The tab list
 * scrolls sideways on narrow screens.
 *
 *   <Tabs label="Results" value={tab} onChange={setTab}
 *         items={[{ value: 'drafts', label: 'Drafts', count: 2 }, …]}>
 *     <TabPanel value="drafts">…</TabPanel>
 *   </Tabs>
 */
export function Tabs({ items, value, onChange, label, className, children }) {
  const baseId = useId();
  const tabId = (v) => `${baseId}-tab-${v}`;
  const panelId = (v) => `${baseId}-panel-${v}`;

  const onKeyDown = (event) => {
    const enabled = items.filter((item) => !item.disabled);
    const index = enabled.findIndex((item) => item.value === value);
    const next = {
      ArrowRight: enabled[(index + 1) % enabled.length],
      ArrowLeft: enabled[(index - 1 + enabled.length) % enabled.length],
      Home: enabled[0],
      End: enabled.at(-1),
    }[event.key];
    if (!next) return;
    event.preventDefault();
    onChange(next.value);
    document.getElementById(tabId(next.value))?.focus();
  };

  return (
    <TabsContext.Provider value={{ value, tabId, panelId }}>
      <div className={className}>
        <div
          role="tablist"
          aria-label={label}
          onKeyDown={onKeyDown}
          className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
        >
          {items.map((item) => {
            const selected = item.value === value;
            const Icon = item.icon;
            return (
              <button
                key={item.value}
                id={tabId(item.value)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId(item.value)}
                tabIndex={selected ? 0 : -1}
                disabled={item.disabled}
                onClick={() => onChange(item.value)}
                className={cn(
                  '-mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-3 px-3 font-semibold whitespace-nowrap transition-colors disabled:opacity-50',
                  selected
                    ? 'border-cerise-500 text-brand-800'
                    : 'border-transparent text-sand-600 hover:border-sand-300 hover:text-ink',
                )}
              >
                {Icon && <Icon aria-hidden="true" className="size-5" />}
                {item.label}
                {item.count != null && (
                  <span
                    className={cn(
                      'min-w-6 rounded-full px-1.5 text-center text-xs leading-6',
                      selected ? 'bg-brand-800 text-white' : 'bg-sand-100 text-sand-700',
                    )}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

/** Content for one tab; only the selected panel renders. */
export function TabPanel({ value, className, children }) {
  const context = useContext(TabsContext);
  if (!context || context.value !== value) return null;
  return (
    <div
      role="tabpanel"
      id={context.panelId(value)}
      aria-labelledby={context.tabId(value)}
      tabIndex={0}
      className={cn('pt-4 focus-visible:outline-offset-4', className)}
    >
      {children}
    </div>
  );
}
