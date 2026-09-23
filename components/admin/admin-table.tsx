"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input, Skeleton, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

/** Generic paginated admin table backed by a JSON endpoint (SPEC §19). */
export function AdminTable<T>({ endpoint, rowsKey, columns, searchable, queryKey, extraParams, rowKey, onRowClick, refreshToken }: {
  endpoint: string;
  rowsKey: string;
  columns: Column<T>[];
  searchable?: boolean;
  queryKey: string;
  extraParams?: Record<string, string>;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  refreshToken?: number;
}) {
  const [page, setPage] = React.useState(0);
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  const params = new URLSearchParams({ page: String(page), ...(debounced ? { q: debounced } : {}), ...(extraParams ?? {}) }).toString();
  const { data, isLoading } = useQuery<Record<string, unknown> & { total: number; page_size: number }>({ queryKey: [queryKey, params, refreshToken], queryFn: () => api(`${endpoint}?${params}`) });
  const rows = (data?.[rowsKey] as T[] | undefined) ?? [];
  return (
    <div className="flex flex-col gap-3">
      {searchable && <Input className="w-72" placeholder="Search…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />}
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <Table>
          <THead>
            <TR>
              {columns.map((c) => (
                <TH key={c.key} className={c.className}>{c.header}</TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={rowKey(r)} className={onRowClick ? "cursor-pointer" : ""} onClick={() => onRowClick?.(r)}>
                {columns.map((c) => (
                  <TD key={c.key} className={c.className}>{c.render(r)}</TD>
                ))}
              </TR>
            ))}
            {!rows.length && (
              <TR>
                <TD colSpan={columns.length} className="text-muted-foreground py-6 text-center">No rows</TD>
              </TR>
            )}
          </TBody>
        </Table>
      )}
      {data && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{data.total} total</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={(page + 1) * data.page_size >= data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
