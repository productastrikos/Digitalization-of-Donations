import React, { useMemo, useState } from 'react';

/**
 * DataTable — generic searchable/sortable/paginated table used across every
 * registry-style page (Donation Box Registry, Inspections, Violations, …).
 *
 * columns: [{ key, header, render(row), sortValue(row)?, width? }]
 */
export default function DataTable({ columns, data, keyExtractor, onRowClick, pageSize = 15, emptyLabel = 'No records match the current filters.', sort: controlledSort, onSortChange, stickyHeader = false }) {
  const [page, setPage] = useState(0);
  const [internalSort, setInternalSort] = useState(null);
  const sort = controlledSort !== undefined ? controlledSort : internalSort;
  const setSort = onSortChange || setInternalSort;

  const sorted = useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return data;
    return [...data].sort((a, b) => {
      const av = col.sortValue(a); const bv = col.sortValue(b);
      if (av < bv) return -1 * sort.dir;
      if (av > bv) return 1 * sort.dir;
      return 0;
    });
  }, [data, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageData = sorted.slice(page * pageSize, page * pageSize + pageSize);

  function toggleSort(key) {
    setSort(sort?.key === key ? { key, dir: sort.dir === 1 ? -1 : 1 } : { key, dir: 1 });
    setPage(0);
  }

  return (
    <div className="flex flex-col">
      {/* stickyHeader: the table scrolls inside its own frame so the column titles stay pinned while rows scroll */}
      <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--app-border)', ...(stickyHeader ? { overflowY: 'auto', maxHeight: 'calc(100vh - 230px)' } : null) }}>
        <table className="w-full border-collapse text-left" style={{ fontSize: '12px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--app-border)', background: 'var(--app-surface-soft)' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ ...(stickyHeader ? { position: 'sticky', top: 0, zIndex: 2, backgroundColor: 'var(--app-panel)', backgroundImage: 'linear-gradient(var(--app-surface-soft), var(--app-surface-soft))', boxShadow: 'inset 0 -1px 0 var(--app-border)' } : null), width: col.width, whiteSpace: 'nowrap', padding: '8px 12px', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--app-text-faint)', cursor: col.sortValue ? 'pointer' : 'default', userSelect: 'none' }}
                  onClick={() => col.sortValue && toggleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortValue && <span style={{ opacity: 0.5, fontSize: 9 }}>↕</span>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row) => (
              <tr
                key={keyExtractor(row)}
                onClick={() => onRowClick?.(row)}
                style={{ borderBottom: '1px solid var(--app-border-soft)', cursor: onRowClick ? 'pointer' : 'default' }}
                className={onRowClick ? 'hover:bg-white/[0.03]' : ''}
              >
                {columns.map((col) => (
                  <td key={col.key} style={{ whiteSpace: 'nowrap', padding: '8px 12px', color: 'var(--app-text-muted)' }}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {pageData.length === 0 && (
              <tr><td colSpan={columns.length} style={{ padding: '32px 12px', textAlign: 'center', fontSize: 12, color: 'var(--app-text-faint)' }}>{emptyLabel}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-2" style={{ fontSize: 11, color: 'var(--app-text-faint)' }}>
        <span>
          Showing {sorted.length === 0 ? 0 : page * pageSize + 1}–{Math.min(sorted.length, (page + 1) * pageSize)} of {sorted.length.toLocaleString()} records
        </span>
        <div className="flex items-center gap-1.5">
          <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="icon-btn" style={{ width: 24, height: 24, opacity: page === 0 ? 0.3 : 1 }}>‹</button>
          <span className="px-1">Page {page + 1} / {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} className="icon-btn" style={{ width: 24, height: 24, opacity: page >= totalPages - 1 ? 0.3 : 1 }}>›</button>
        </div>
      </div>
    </div>
  );
}
