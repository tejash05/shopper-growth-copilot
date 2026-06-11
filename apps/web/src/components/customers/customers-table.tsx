'use client';

import * as React from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from 'lucide-react';
import {
  CITIES,
  ChurnRisk,
  LoyaltyTier,
  PERSONA_LABELS,
  Persona,
  ProductCategory,
  formatInr,
  formatInrCompact,
  type CustomerListItem,
  type Paginated,
} from '@scp/shared';
import { api } from '@/lib/api';
import { useDebounce } from '@/lib/hooks';
import { useBrand } from '@/contexts/brand-context';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ChurnBadge, PersonaBadge, TierBadge } from '@/components/shared/labels';
import { EmptyState, ErrorState } from '@/components/shared/states';
import { CustomerDetailDrawer } from './customer-detail-drawer';

type SortKey = 'totalSpend' | 'lastPurchaseAt' | 'orderCount' | 'rfmTotal' | 'lifetimeValue';

export function CustomersTable() {
  const { selectedBrandId } = useBrand();
  const [page, setPage] = React.useState(1);
  const [sortBy, setSortBy] = React.useState<SortKey>('totalSpend');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const [searchInput, setSearchInput] = React.useState('');
  const search = useDebounce(searchInput, 350);
  const [filters, setFilters] = React.useState({
    city: '',
    churnRisk: '',
    persona: '',
    favouriteCategory: '',
    loyaltyTier: '',
  });
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  React.useEffect(() => setPage(1), [search, filters, sortBy, sortDir]);

  const pageSize = 25;
  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sortBy,
    sortDir,
    ...(search ? { search } : {}),
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
  }).toString();

  const { data, isLoading, isError, isFetching } = useQuery<Paginated<CustomerListItem>>({
    queryKey: ['customers', selectedBrandId, qs],
    queryFn: () => api.customers(qs),
    enabled: Boolean(selectedBrandId),
    placeholderData: keepPreviousData,
  });

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortDir('desc');
    }
  };

  const columns = React.useMemo<ColumnDef<CustomerListItem>[]>(
    () => [
      {
        header: 'Shopper',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-[180px]">
            <p className="font-medium text-foreground">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        ),
      },
      { header: 'City', accessorKey: 'city', cell: ({ getValue }) => <span className="text-sm">{getValue<string>()}</span> },
      {
        header: 'Persona',
        accessorKey: 'persona',
        cell: ({ getValue }) => <PersonaBadge persona={getValue<Persona>()} />,
      },
      { header: 'Tier', accessorKey: 'loyaltyTier', cell: ({ getValue }) => <TierBadge tier={getValue<LoyaltyTier>()} /> },
      { header: 'Churn', accessorKey: 'churnRisk', cell: ({ getValue }) => <ChurnBadge risk={getValue<ChurnRisk>()} /> },
      {
        header: 'Total spend',
        accessorKey: 'totalSpend',
        cell: ({ getValue }) => <span className="tabular-nums font-medium">{formatInr(getValue<number>())}</span>,
      },
      { header: 'Orders', accessorKey: 'orderCount', cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()}</span> },
      {
        header: 'LTV',
        accessorKey: 'lifetimeValue',
        cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{formatInrCompact(getValue<number>())}</span>,
      },
      { header: 'RFM', accessorKey: 'rfmCell', cell: ({ getValue }) => <span className="font-mono text-xs text-muted-foreground">{getValue<string>()}</span> },
      {
        header: 'Last order',
        accessorKey: 'lastPurchaseAt',
        cell: ({ getValue }) => {
          const v = getValue<string | null>();
          return <span className="text-xs text-muted-foreground">{v ? new Date(v).toLocaleDateString('en-IN') : '—'}</span>;
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  const SORTABLE: Record<string, SortKey> = {
    totalSpend: 'totalSpend',
    orderCount: 'orderCount',
    lifetimeValue: 'lifetimeValue',
    lastPurchaseAt: 'lastPurchaseAt',
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, phone..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <FilterSelect value={filters.city} onChange={(v) => setFilters((f) => ({ ...f, city: v }))} placeholder="All cities" options={CITIES.map((c) => ({ value: c, label: c }))} />
        <FilterSelect value={filters.churnRisk} onChange={(v) => setFilters((f) => ({ ...f, churnRisk: v }))} placeholder="All churn" options={Object.values(ChurnRisk).map((c) => ({ value: c, label: c[0] + c.slice(1).toLowerCase() }))} />
        <FilterSelect value={filters.persona} onChange={(v) => setFilters((f) => ({ ...f, persona: v }))} placeholder="All personas" options={Object.values(Persona).map((p) => ({ value: p, label: PERSONA_LABELS[p] }))} />
        <FilterSelect value={filters.favouriteCategory} onChange={(v) => setFilters((f) => ({ ...f, favouriteCategory: v }))} placeholder="All categories" options={Object.values(ProductCategory).map((c) => ({ value: c, label: c[0] + c.slice(1).toLowerCase() }))} />
        <FilterSelect value={filters.loyaltyTier} onChange={(v) => setFilters((f) => ({ ...f, loyaltyTier: v }))} placeholder="All tiers" options={Object.values(LoyaltyTier).map((t) => ({ value: t, label: t[0] + t.slice(1).toLowerCase() }))} />
      </div>

      <div className="rounded-xl border border-border bg-card">
        {isError ? (
          <div className="p-6">
            <ErrorState title="Couldn't load shoppers" description="Check that the CRM API is running." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="hover:bg-transparent">
                  {hg.headers.map((header) => {
                    const key = header.column.id;
                    const sortable = SORTABLE[key];
                    return (
                      <TableHead key={header.id}>
                        {sortable ? (
                          <button
                            onClick={() => toggleSort(sortable)}
                            className="inline-flex items-center gap-1 hover:text-foreground"
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sortBy === sortable ? (
                              sortDir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                            ) : (
                              <ChevronsUpDown className="size-3 opacity-50" />
                            )}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i} className="hover:bg-transparent">
                    {columns.map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="py-12">
                    <EmptyState title="No shoppers match these filters" description="Try clearing a filter or adjusting your search." className="border-0 bg-transparent py-0" />
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="cursor-pointer" onClick={() => setSelectedId(row.original.id)}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
          <p className="text-muted-foreground">
            {data ? (
              <>
                {(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} of{' '}
                {data.total.toLocaleString('en-IN')}
                {isFetching && <span className="ml-2 text-xs">updating…</span>}
              </>
            ) : (
              '—'
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={!data || page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {data?.page ?? 1} of {data?.totalPages ?? 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!data || page >= (data?.totalPages ?? 1)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <CustomerDetailDrawer customerId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className="w-auto min-w-[140px]">
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
