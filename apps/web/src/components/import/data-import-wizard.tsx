'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
} from 'lucide-react';
import type { ImportPayload, ImportPreviewResult } from '@scp/shared';
import { useBrand } from '@/contexts/brand-context';
import { api, ApiError } from '@/lib/api';
import {
  downloadCustomerCsvTemplate,
  downloadJsonTemplate,
  downloadOrderCsvTemplate,
} from '@/lib/import-templates';
import { Topbar } from '@/components/layout/topbar';
import { ImportUploadZone } from '@/components/import/import-upload-zone';
import {
  ImportProgressBar,
  ImportProgressCard,
  ImportProgressState,
  ImportStepIndicator,
  TemplateDownloadCard,
} from '@/components/import/import-progress-ui';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

type Step = 'upload' | 'preview' | 'validate' | 'import' | 'done';

const STEPS: { id: Step; label: string }[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'preview', label: 'Preview' },
  { id: 'validate', label: 'Validate' },
  { id: 'import', label: 'Import' },
  { id: 'done', label: 'Done' },
];

function stepIndex(step: Step): number {
  return STEPS.findIndex((s) => s.id === step);
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function DataImportWizard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { selectedBrand } = useBrand();
  const [step, setStep] = React.useState<Step>('upload');
  const [customersFile, setCustomersFile] = React.useState<File | null>(null);
  const [ordersFile, setOrdersFile] = React.useState<File | null>(null);
  const [jsonFile, setJsonFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<ImportPreviewResult | null>(null);
  const [payload, setPayload] = React.useState<ImportPayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [importSlow, setImportSlow] = React.useState(false);
  const [progress, setProgress] = React.useState<ImportProgressState | null>(null);
  const [commitResult, setCommitResult] = React.useState<{
    customersImported: number;
    ordersImported: number;
    rowsSkipped: number;
  } | null>(null);

  const jobsQuery = useQuery({
    queryKey: ['import-jobs', selectedBrand?.id],
    queryFn: () => api.importJobs(),
    enabled: Boolean(selectedBrand?.id),
  });

  const reset = () => {
    setStep('upload');
    setCustomersFile(null);
    setOrdersFile(null);
    setJsonFile(null);
    setPreview(null);
    setPayload(null);
    setError(null);
    setCommitResult(null);
    setImportSlow(false);
    setProgress(null);
  };

  const onPreview = async () => {
    if (!jsonFile && !customersFile && !ordersFile) {
      setError('Choose a JSON file or at least one CSV file.');
      return;
    }
    setLoading(true);
    setError(null);
    setProgress({ percent: 10, label: 'Uploading file…' });

    try {
      await wait(200);
      setProgress({ percent: 30, label: 'Parsing file…' });

      const formData = new FormData();
      if (jsonFile) formData.append('file', jsonFile);
      if (customersFile) formData.append('customersFile', customersFile);
      if (ordersFile) formData.append('ordersFile', ordersFile);

      setProgress({ percent: 50, label: 'Validating rows…' });
      const result = await api.importPreview(formData);

      setPreview(result);
      setPayload(result.payload ?? null);
      setStep(result.valid ? 'preview' : 'validate');
      setProgress({ percent: 100, label: 'Validation complete' });
      await wait(250);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not preview import.');
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const onCommit = async () => {
    if (!payload) return;
    setLoading(true);
    setError(null);
    setImportSlow(false);
    setStep('import');
    setProgress({ percent: 75, label: 'Importing shoppers and orders…' });

    const controller = new AbortController();
    const slowTimer = window.setTimeout(() => setImportSlow(true), 30_000);
    const timeoutTimer = window.setTimeout(() => controller.abort(), 5 * 60_000);
    const recomputeTimer = window.setTimeout(() => {
      setProgress({ percent: 90, label: 'Recomputing customer intelligence…' });
    }, 4_000);

    try {
      const result = await api.importCommit(payload, controller.signal);
      setProgress({ percent: 100, label: 'Done' });
      setCommitResult({
        customersImported: result.customersImported,
        ordersImported: result.ordersImported,
        rowsSkipped: result.rowsSkipped,
      });
      queryClient.invalidateQueries();
      router.refresh();
      await jobsQuery.refetch();
      await wait(400);
      setStep('done');
    } catch (err) {
      setStep('validate');
      if (controller.signal.aborted) {
        setError('Import timed out after 5 minutes. Try a smaller file or retry in a moment.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Import failed.');
      }
    } finally {
      window.clearTimeout(slowTimer);
      window.clearTimeout(timeoutTimer);
      window.clearTimeout(recomputeTimer);
      setLoading(false);
      setImportSlow(false);
      setProgress(null);
    }
  };

  const currentStep = stepIndex(step);
  const hasFile = Boolean(jsonFile || customersFile || ordersFile);
  const csvMode = !jsonFile;

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Import into {selectedBrand?.name ?? 'workspace'}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload shopper and order data for this workspace only. Supported formats: CSV and JSON
            (max 10MB, 10,000 customers / 50,000 orders).
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <ImportStepIndicator steps={STEPS} currentIndex={currentStep} />

          {progress && step === 'upload' && loading && (
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <ImportProgressBar progress={progress} />
            </div>
          )}

          {step === 'upload' && (
            <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="space-y-4 rounded-xl border border-border bg-muted/10 p-5">
                <div>
                  <p className="text-sm font-semibold text-foreground">Upload files</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Choose a combined JSON file or upload customers and orders as separate CSV files.
                  </p>
                </div>

                <ImportUploadZone
                  id="import-json-file"
                  title="Upload combined JSON"
                  description="Customers + orders in one file"
                  formatLabel="Supports .json up to 10MB"
                  accept=".json,application/json"
                  file={jsonFile}
                  onFileChange={(file) => {
                    setJsonFile(file);
                    if (file) {
                      setCustomersFile(null);
                      setOrdersFile(null);
                    }
                  }}
                />

                <div className="relative py-1">
                  <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
                  <p className="relative mx-auto w-fit bg-muted/10 px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    or upload CSV separately
                  </p>
                </div>

                <ImportUploadZone
                  id="import-customers-file"
                  title="Upload customers.csv"
                  description="Shopper profiles and consent fields"
                  formatLabel="Supports .csv up to 10MB"
                  accept=".csv,text/csv"
                  file={customersFile}
                  disabled={Boolean(jsonFile)}
                  onFileChange={setCustomersFile}
                />

                <ImportUploadZone
                  id="import-orders-file"
                  title="Upload orders.csv"
                  description="Order lines linked to shoppers"
                  formatLabel="Supports .csv up to 10MB"
                  accept=".csv,text/csv"
                  file={ordersFile}
                  disabled={Boolean(jsonFile)}
                  onFileChange={setOrdersFile}
                />

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button onClick={onPreview} disabled={loading || !hasFile}>
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                    Continue to preview
                  </Button>
                  {csvMode && !customersFile && !ordersFile && !jsonFile && (
                    <p className="self-center text-xs text-muted-foreground">
                      Upload JSON or at least one CSV file to continue.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Sample templates</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Download a starter file with the expected columns and formats.
                  </p>
                </div>
                <TemplateDownloadCard
                  title="Customer CSV template"
                  description="Shopper identity, consent, and channel fields"
                  icon={FileSpreadsheet}
                  onClick={downloadCustomerCsvTemplate}
                />
                <TemplateDownloadCard
                  title="Order CSV template"
                  description="Order value, product, and customer references"
                  icon={FileSpreadsheet}
                  onClick={downloadOrderCsvTemplate}
                />
                <TemplateDownloadCard
                  title="JSON template"
                  description="Combined customers and orders payload"
                  icon={FileText}
                  onClick={downloadJsonTemplate}
                />
              </div>
            </div>
          )}

          {(step === 'preview' || step === 'validate') && preview && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryCard label="Customers" value={preview.summary.customerCount} />
                <SummaryCard label="Orders" value={preview.summary.orderCount} />
                <SummaryCard
                  label="Validation errors"
                  value={preview.summary.errorCount}
                  tone={preview.summary.errorCount > 0 ? 'danger' : 'success'}
                />
              </div>

              {preview.errors.length > 0 && (
                <Card className="border-destructive/30 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="size-4" />
                      Row-level validation errors
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Entity</TableHead>
                          <TableHead>Field</TableHead>
                          <TableHead>Message</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.errors.slice(0, 50).map((row, idx) => (
                          <TableRow key={`${row.rowNumber}-${idx}`}>
                            <TableCell>{row.rowNumber}</TableCell>
                            <TableCell>{row.entityType}</TableCell>
                            <TableCell>{row.field ?? '—'}</TableCell>
                            <TableCell>{row.message}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {preview.preview.customers.length > 0 && (
                <PreviewTable title="Customer preview (first 10 rows)" rows={preview.preview.customers} />
              )}
              {preview.preview.orders.length > 0 && (
                <PreviewTable title="Order preview (first 10 rows)" rows={preview.preview.orders} />
              )}

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={reset}>
                  Upload another file
                </Button>
                {preview.valid && payload && (
                  <Button onClick={onCommit} disabled={loading}>
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    Import into {selectedBrand?.name ?? 'workspace'}
                  </Button>
                )}
              </div>
            </div>
          )}

          {step === 'import' && progress && (
            <ImportProgressCard
              progress={progress}
              workspaceName={selectedBrand?.name ?? 'this workspace'}
              slowMessage={
                importSlow
                  ? "This is taking longer than expected because we're writing customers, orders and recalculating shopper intelligence."
                  : null
              }
            />
          )}

          {step === 'done' && commitResult && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 text-emerald-600" />
                <div className="w-full space-y-4">
                  <div>
                    <p className="font-medium text-foreground">Import complete</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Imported {commitResult.customersImported.toLocaleString('en-IN')} shoppers and{' '}
                      {commitResult.ordersImported.toLocaleString('en-IN')} orders into{' '}
                      {selectedBrand?.name ?? 'your workspace'}.
                    </p>
                    {commitResult.rowsSkipped > 0 && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {commitResult.rowsSkipped.toLocaleString('en-IN')} rows were skipped.
                      </p>
                    )}
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-emerald-500/15">
                    <div className="h-full w-full rounded-full bg-emerald-500 transition-all" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href="/" className={buttonVariants()}>
                      View dashboard
                    </Link>
                    <Link href="/customers" className={buttonVariants({ variant: 'outline' })}>
                      View shoppers
                    </Link>
                    <Button variant="ghost" onClick={reset}>
                      Import another file
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Recent imports</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {jobsQuery.isLoading ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Loading import history…</p>
              <div className="h-2 w-40 animate-pulse rounded-full bg-muted" />
            </div>
          ) : (jobsQuery.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No imports yet for this workspace.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Shoppers</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobsQuery.data?.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>{job.fileName}</TableCell>
                    <TableCell>{job.sourceType}</TableCell>
                    <TableCell>{job.status}</TableCell>
                    <TableCell>{job.customersImported}</TableCell>
                    <TableCell>{job.ordersImported}</TableCell>
                    <TableCell>{new Date(job.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'success' | 'danger';
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 text-2xl font-semibold',
          tone === 'danger' && 'text-destructive',
          tone === 'success' && 'text-emerald-600',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function PreviewTable({ title, rows }: { title: string; rows: Record<string, unknown>[] }) {
  const columns = Object.keys(rows[0] ?? {});
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col}>{col}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={idx}>
                {columns.map((col) => (
                  <TableCell key={col}>{String(row[col] ?? '')}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function DataImportPageShell() {
  const { selectedBrand } = useBrand();
  return (
    <>
      <Topbar
        title="Data Import"
        subtitle={`Upload shopper and order data for ${selectedBrand?.name ?? 'your workspace'}`}
      />
      <div className="p-6">
        <DataImportWizard />
      </div>
    </>
  );
}
