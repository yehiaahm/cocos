import { useRef, type KeyboardEvent } from 'react';

/**
 * WAI-ARIA tabs keyboard support: arrows move and select, Home/End jump.
 * Returns props to spread on the tablist and a ref callback per tab.
 */
export function useTabs(count: number, selected: number, onSelect: (i: number) => void) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: KeyboardEvent) => {
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (selected + 1) % count;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (selected - 1 + count) % count;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = count - 1;
    if (next < 0) return;
    e.preventDefault();
    onSelect(next);
    refs.current[next]?.focus();
  };
  return {
    listProps: { role: 'tablist' as const, onKeyDown },
    tabProps: (i: number) => ({
      ref: (el: HTMLButtonElement | null) => {
        refs.current[i] = el;
      },
      role: 'tab' as const,
      'aria-selected': i === selected,
      tabIndex: i === selected ? 0 : -1,
      onClick: () => onSelect(i),
    }),
  };
}
