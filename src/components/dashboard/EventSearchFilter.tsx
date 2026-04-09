'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';

export function EventSearchFilter() {
  const [query, setQuery] = useState('');

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
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search events..."
        className="w-48 rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-sm outline-none transition-all focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 placeholder:text-gray-400"
      />
    </div>
  );
}
