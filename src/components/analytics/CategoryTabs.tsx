import { useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import type { AnalyticsCategory } from '@/lib/api/analytics';

const CATEGORIES: { value: AnalyticsCategory; label: string }[] = [
  { value: 'marble', label: 'Marble' },
  { value: 'magro', label: 'Magro' },
];

export function tabId(category: AnalyticsCategory) {
  return `analytics-tab-${category}`;
}

export function panelId(category: AnalyticsCategory) {
  return `analytics-panel-${category}`;
}

interface CategoryTabsProps {
  value: AnalyticsCategory;
  onChange: (value: AnalyticsCategory) => void;
}

/**
 * Top-level Marble / Magro switch.
 *
 * Built as a true ARIA tablist (the repo has no tabs primitive, and adding
 * @radix-ui/react-tabs for two buttons isn't worth a dependency): roving
 * tabindex, Left/Right/Home/End navigation, and aria-controls wired to the
 * panel that ReportsView renders. Activation follows focus, which is the
 * right call for a two-tab view where switching is cheap.
 */
export default function CategoryTabs({ value, onChange }: CategoryTabsProps) {
  const refs = useRef<Record<AnalyticsCategory, HTMLButtonElement | null>>({ marble: null, magro: null });

  const focusTab = (index: number) => {
    const next = CATEGORIES[(index + CATEGORIES.length) % CATEGORIES.length];
    onChange(next.value);
    refs.current[next.value]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        focusTab(index + 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        focusTab(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusTab(0);
        break;
      case 'End':
        event.preventDefault();
        focusTab(CATEGORIES.length - 1);
        break;
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Product category"
      className="inline-flex rounded-xl bg-slate-100 p-1"
    >
      {CATEGORIES.map((category, index) => {
        const selected = category.value === value;
        return (
          <button
            key={category.value}
            ref={(el) => {
              refs.current[category.value] = el;
            }}
            type="button"
            role="tab"
            id={tabId(category.value)}
            aria-selected={selected}
            aria-controls={panelId(category.value)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(category.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'min-h-[40px] min-w-[104px] rounded-lg px-5 text-sm font-semibold transition-all',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100',
              selected
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900',
            )}
          >
            {category.label}
          </button>
        );
      })}
    </div>
  );
}
