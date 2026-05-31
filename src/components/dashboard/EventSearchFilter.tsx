'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

export function EventSearchFilter() {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus on '/' if not already typing in an input
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function handleSearch(value: string) {
    setQuery(value);
    const list = document.getElementById('my-events-list');
    if (!list) return;

    const items = list.querySelectorAll('li');
    items.forEach((item) => {
      const text = item.textContent?.toLowerCase() || '';
      item.style.display = text.includes(value.toLowerCase()) ? '' : 'none';
    });
  }

  return (
    <div className="relative group">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 transition-colors group-focus-within:text-brand-600" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search events..."
        aria-label="Search events"
        className="w-48 rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-8 py-2 text-sm outline-none transition-all focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 placeholder:text-gray-500"
      />
      {query ? (
        <button
          onClick={() => {
            handleSearch('');
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border border-gray-200 bg-white px-1.5 font-mono text-[10px] font-medium text-gray-400 opacity-100 sm:flex group-focus-within:hidden">
          <span>/</span>
        </kbd>
      )}
    </div>
  );
}
