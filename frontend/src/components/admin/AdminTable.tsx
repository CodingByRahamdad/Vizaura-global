import type { ReactNode } from "react";

export interface AdminTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface AdminTableProps<T> {
  columns: AdminTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
}

/** Column-def driven so future admin modules (Inventory, Orders, …) reuse this without a new table implementation. */
export function AdminTable<T>({ columns, rows, getRowKey }: AdminTableProps<T>) {
  return (
    <div className="scrollbar-thin overflow-x-auto rounded-lg border border-border bg-surface">
      {/* No min-w-*: `min-w-max` (and `min-w-full`) resolved against the viewport here, forcing every table to the
          viewport width (1280px in a 958px wrapper) and clipping the last column(s) behind a horizontal scroll on
          desktop. A plain w-full table still can't shrink below its content's min-content width, so the wrapper's
          overflow-x-auto scrolls when the columns genuinely don't fit. */}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-bg/60 text-left">
            {columns.map((column) => (
              <th key={column.key} className="whitespace-nowrap px-4 py-3 font-medium text-text-secondary">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)} className="border-b border-border last:border-0 hover:bg-bg/40">
              {columns.map((column) => (
                <td key={column.key} className={column.className ?? "px-4 py-3 align-middle text-text"}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
