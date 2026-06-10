'use client';

import * as React from 'react';

/** Debounce any fast-changing value (e.g. a search box). */
export function useDebounce<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
