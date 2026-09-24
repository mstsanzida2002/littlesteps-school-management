import { Search, X } from 'lucide-react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { cn } from '../../utils/cn.js';
import { fieldClasses } from './fieldStyles.js';

/**
 * Search box that calls onSearch(text) after the user pauses typing (`delay` ms), immediately
 * on Enter, and with '' when cleared. `value` is the applied search (e.g. from the URL); when
 * it changes from outside (filters reset), the box follows.
 */
export function SearchInput({
  value = '',
  onSearch,
  label = 'Search',
  placeholder = 'Search…',
  delay = 350,
  className,
  ...props
}) {
  const [text, setText] = useState(value);
  const [applied, setApplied] = useState(value);
  if (value !== applied) {
    setApplied(value);
    setText(value);
  }

  const lastSent = useRef(value);
  const send = (query) => {
    lastSent.current = query;
    onSearch?.(query);
  };
  const sendLater = useEffectEvent((query) => {
    if (query !== lastSent.current) send(query);
  });

  useEffect(() => {
    const timer = setTimeout(() => sendLater(text.trim()), delay);
    return () => clearTimeout(timer);
  }, [text, delay]);

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-sand-500" />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            send(text.trim());
          }
          if (event.key === 'Escape' && text) {
            event.preventDefault();
            setText('');
            send('');
          }
        }}
        className={fieldClasses(false, 'pr-12 pl-11 [&::-webkit-search-cancel-button]:hidden')}
        {...props}
      />
      {text && (
        <button
          type="button"
          aria-label="Clear search"
          title="Clear search"
          onClick={() => {
            setText('');
            send('');
          }}
          className="absolute top-1/2 right-0.5 grid size-11 -translate-y-1/2 place-items-center rounded-control text-sand-600 hover:text-brand-800"
        >
          <X className="size-5" />
        </button>
      )}
    </div>
  );
}
