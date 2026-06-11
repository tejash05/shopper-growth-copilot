'use client';

import * as React from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export interface ImportUploadZoneProps {
  id: string;
  title: string;
  description: string;
  formatLabel: string;
  accept: string;
  file: File | null;
  disabled?: boolean;
  onFileChange: (file: File | null) => void;
}

export function ImportUploadZone({
  id,
  title,
  description,
  formatLabel,
  accept,
  file,
  disabled = false,
  onFileChange,
}: ImportUploadZoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = React.useState(false);

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFileChange(event.target.files?.[0] ?? null);
    event.target.value = '';
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (disabled) return;
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) onFileChange(dropped);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={onInputChange}
        aria-describedby={`${id}-hint`}
      />
      <div className="relative">
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-hint`}
          onClick={openPicker}
          onKeyDown={onKeyDown}
          onDragEnter={(e) => {
            e.preventDefault();
            if (!disabled) setDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragActive(false);
          }}
          onDrop={onDrop}
          className={cn(
            'group w-full rounded-xl border bg-card p-4 text-left transition-all',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
            !disabled && dragActive && 'border-primary bg-primary/5 shadow-sm',
            !disabled && !dragActive && 'border-border hover:border-primary/40 hover:bg-muted/30',
            file && 'border-primary/30 bg-primary/[0.03]',
            file && !disabled && 'pr-12',
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50 text-primary',
                dragActive && 'border-primary/30 bg-primary/10',
              )}
            >
              {file ? <FileText className="size-5" /> : <Upload className="size-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p id={`${id}-title`} className="text-sm font-medium text-foreground">
                {title}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
              <p id={`${id}-hint`} className="mt-2 text-[11px] text-muted-foreground">
                {formatLabel}
              </p>
              {file ? (
                <div className="mt-3 rounded-lg border border-border bg-background/80 px-3 py-2">
                  <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  Drag and drop a file here, or click to browse
                </p>
              )}
            </div>
          </div>
        </div>

        {file && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3 size-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onFileChange(null);
            }}
            aria-label={`Remove ${file.name}`}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
