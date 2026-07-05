'use client';

interface Props {
  page: number;        // 1-based
  pages: number;       // total pages
  total?: number;      // total row count (optional caption)
  onChange: (page: number) => void;
}

/** Compact pager: ‹ 1 … 4 [5] 6 … 12 › */
export function Pagination({ page, pages, total, onChange }: Props) {
  if (pages <= 1) return null;

  const items: (number | '…')[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) items.push(p);
    else if (items[items.length - 1] !== '…') items.push('…');
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 dark:border-zinc-800">
      <p className="text-xs text-gray-400 dark:text-zinc-400">
        Page {page} of {pages}{total !== undefined ? ` · ${total.toLocaleString()} rows` : ''}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="w-8 h-8 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          ‹
        </button>
        {items.map((it, i) =>
          it === '…' ? (
            <span key={`e${i}`} className="w-8 text-center text-gray-300 text-sm">…</span>
          ) : (
            <button
              key={it}
              onClick={() => onChange(it)}
              className={`w-8 h-8 rounded-lg text-sm transition ${it === page ? 'text-white font-semibold' : 'border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800'}`}
              style={it === page ? { background: 'var(--brand, #ea580c)' } : undefined}
            >
              {it}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= pages}
          className="w-8 h-8 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          ›
        </button>
      </div>
    </div>
  );
}
