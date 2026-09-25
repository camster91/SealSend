"use client";

import { useCallback, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Upload, X, FileImage } from "lucide-react";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSizeMB?: number;
  currentFile?: string | null;
  onRemove?: () => void;
  className?: string;
}

function FileUpload({
  onFileSelect,
  accept = "image/jpeg,image/png,image/webp,application/pdf",
  maxSizeMB = 10,
  currentFile,
  onRemove,
  className,
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback(
    (file: File): boolean => {
      const acceptTypes = accept.split(",").map((t) => t.trim());
      if (!acceptTypes.some((type) => file.type.match(type.replace("*", ".*")))) {
        setError("File type not supported");
        return false;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`File size must be less than ${maxSizeMB}MB`);
        return false;
      }
      setError(null);
      return true;
    },
    [accept, maxSizeMB]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file && validateFile(file)) {
        onFileSelect(file);
      }
    },
    [onFileSelect, validateFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && validateFile(file)) {
        onFileSelect(file);
      }
    },
    [onFileSelect, validateFile]
  );

  if (currentFile) {
    return (
      <div
        className={cn(
          "relative rounded-xl border border-border bg-neutral-50 p-4",
          className
        )}
      >
        <div className="flex items-center gap-3">
          <FileImage className="h-10 w-10 text-brand-500" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">Design uploaded</p>
            <p className="text-xs text-muted-foreground">
              Click remove to upload a different file
            </p>
          </div>
          {onRemove && (
            <button
              onClick={onRemove}
              aria-label="Remove uploaded file"
              className="rounded-lg p-1.5 hover:bg-neutral-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors",
          dragActive
            ? "border-brand-500 bg-brand-50"
            : "border-neutral-300 hover:border-brand-400 hover:bg-neutral-50"
        )}
      >
        <Upload
          className={cn(
            "mb-3 h-10 w-10",
            dragActive ? "text-brand-500" : "text-muted-foreground"
          )}
        />
        <p className="text-sm font-medium text-foreground">
          Drop your design here, or{" "}
          <span className="text-brand-600">browse</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          JPG, PNG, WebP or PDF (max {maxSizeMB}MB)
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
        />
      </div>
      {error && <p className="mt-2 text-sm text-accent-red">{error}</p>}
    </div>
  );
}

export { FileUpload };
