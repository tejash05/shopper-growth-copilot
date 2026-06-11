'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, ChevronDown, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useBrand } from '@/contexts/brand-context';
import { NOVAWEAR_BRAND_NAME } from '@/lib/brand-storage';
import { api, ApiError } from '@/lib/api';
import { DeleteWorkspaceDialog } from '@/components/layout/delete-workspace-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

export function WorkspaceSelector() {
  const { brands, selectedBrand, selectedBrandId, isLoading, setSelectedBrandId, createBrand, deleteBrand } =
    useBrand();
  const [open, setOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [industry, setIndustry] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createBrand({ name: name.trim(), industry: industry.trim() });
      setName('');
      setIndustry('');
      setCreating(false);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create workspace.');
    } finally {
      setSubmitting(false);
    }
  };

  const isNovaWear = selectedBrand?.name === NOVAWEAR_BRAND_NAME;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2 rounded-lg bg-muted/60 p-3 text-left transition-colors hover:bg-muted"
        disabled={isLoading}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Building2 className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">
            {isLoading ? 'Loading…' : (selectedBrand?.name ?? 'Select workspace')}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {selectedBrand?.industry ?? 'Workspace'}
          </p>
        </div>
        <ChevronDown className={cn('mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-xl border border-border bg-card p-2 shadow-lg">
          <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Workspaces
          </p>
          <div className="max-h-48 space-y-0.5 overflow-y-auto">
            {brands.map((brand) => (
              <button
                key={brand.id}
                type="button"
                onClick={() => {
                  setSelectedBrandId(brand.id);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full flex-col rounded-lg px-2 py-2 text-left text-sm hover:bg-muted',
                  brand.id === selectedBrandId && 'bg-primary/10 text-primary',
                )}
              >
                <span className="font-medium">{brand.name}</span>
                <span className="text-xs text-muted-foreground">{brand.industry}</span>
              </button>
            ))}
          </div>
          {!creating ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              onClick={() => setCreating(true)}
            >
              <Plus className="size-4" />
              Create workspace
            </Button>
          ) : (
            <form onSubmit={onCreate} className="mt-2 space-y-2 border-t border-border pt-2">
              <div>
                <Label htmlFor="ws-name">Company name</Label>
                <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="ws-industry">Industry</Label>
                <Input
                  id="ws-industry"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="Fashion retail"
                  required
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={submitting} className="flex-1">
                  {submitting ? 'Creating…' : 'Create'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          <div className="mt-2 border-t border-border pt-2">
            {isNovaWear ? (
              <p className="px-2 py-1.5 text-xs leading-relaxed text-muted-foreground">
                NovaWear is the default demo workspace and cannot be deleted.
              </p>
            ) : selectedBrand ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  setDeleteOpen(true);
                  setOpen(false);
                }}
              >
                <Trash2 className="size-4" />
                Delete workspace
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {selectedBrand && (
        <DeleteWorkspaceDialog
          open={deleteOpen}
          workspaceName={selectedBrand.name}
          onClose={() => setDeleteOpen(false)}
          onConfirm={async () => {
            if (!selectedBrandId) return;
            await deleteBrand(selectedBrandId);
          }}
        />
      )}
    </div>
  );
}

/** Actions shown on an empty workspace dashboard. */
export function EmptyWorkspaceActions() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { brands, selectedBrand, selectedBrandId, setSelectedBrandId } = useBrand();
  const novawear = brands.find((b) => b.name === NOVAWEAR_BRAND_NAME);
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = React.useState<string | null>(null);

  const brandName = selectedBrand?.name ?? 'this workspace';
  const generateLabel = selectedBrand
    ? `Generate demo data for ${selectedBrand.name}`
    : 'Generate demo data for this workspace';

  const onGenerate = async () => {
    if (!selectedBrandId) return;
    setStatus('loading');
    setMessage('Generating demo data…');
    try {
      await api.generateDemoData(selectedBrandId);
      queryClient.invalidateQueries();
      router.refresh();
      setStatus('success');
      setMessage(`Demo data generated for ${brandName}`);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof ApiError ? err.message : 'Could not generate demo data');
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-3">
        <Button
          type="button"
          onClick={onGenerate}
          disabled={!selectedBrandId || status === 'loading'}
        >
          <Sparkles className="size-4" />
          {status === 'loading' ? 'Generating demo data…' : generateLabel}
        </Button>
        <Link href="/data-import" className={buttonVariants({ variant: 'outline' })}>
          Upload data
        </Link>
      </div>
      {message && (
        <p
          className={cn(
            'text-sm',
            status === 'error' ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {message}
        </p>
      )}
      {novawear && selectedBrand?.name !== NOVAWEAR_BRAND_NAME && (
        <button
          type="button"
          className="text-sm text-primary underline-offset-4 hover:underline"
          onClick={() => setSelectedBrandId(novawear.id)}
        >
          View NovaWear demo workspace
        </button>
      )}
    </div>
  );
}
