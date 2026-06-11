'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/misc';

interface DeleteWorkspaceDialogProps {
  open: boolean;
  workspaceName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteWorkspaceDialog({
  open,
  workspaceName,
  onClose,
  onConfirm,
}: DeleteWorkspaceDialogProps) {
  const [confirmation, setConfirmation] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canDelete = confirmation === workspaceName;

  React.useEffect(() => {
    if (!open) {
      setConfirmation('');
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose, submitting]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDelete || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('Cannot delete default demo workspace.');
        } else if (err.status === 404) {
          setError('Workspace not found.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Could not delete workspace. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="delete-workspace-title">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={submitting ? undefined : onClose} />
      <div className="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4">
        <form
          onSubmit={onSubmit}
          className="rounded-xl border border-border bg-card p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <h2 id="delete-workspace-title" className="text-lg font-semibold tracking-tight">
                  Delete {workspaceName}?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  This will permanently delete customers, orders, segments, campaigns, communications,
                  import history, and AI runs for this workspace. This action cannot be undone.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delete-workspace-confirm">
                  Type <span className="font-medium text-foreground">{workspaceName}</span> to confirm
                </Label>
                <Input
                  id="delete-workspace-confirm"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder={workspaceName}
                  autoComplete="off"
                  disabled={submitting}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant={canDelete ? 'destructive' : 'default'}
                  disabled={!canDelete || submitting}
                >
                  {submitting ? 'Deleting…' : 'Delete workspace'}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
