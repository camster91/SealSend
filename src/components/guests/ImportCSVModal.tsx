'use client';

import { useState, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Upload, Download, AlertCircle, Check } from 'lucide-react';

interface ImportCSVModalProps {
  open: boolean;
  onClose: () => void;
  eventId: string;
  onSuccess: () => void;
}

interface ParsedGuest {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  row: number;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export function ImportCSVModal({ open, onClose, eventId, onSuccess }: ImportCSVModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedGuest[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseCSV = useCallback((text: string): ParsedGuest[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const guests: ParsedGuest[] = [];
    
    // Skip header if present
    const startIndex = lines[0].toLowerCase().includes('name') ? 1 : 0;
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      // Handle quoted fields
      const fields: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          fields.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      fields.push(current.trim());
      
      const [name, email, phone, notes] = fields;
      if (name?.trim()) {
        guests.push({
          name: name.trim(),
          email: email?.trim() || undefined,
          phone: phone?.trim() || undefined,
          notes: notes?.trim() || undefined,
          row: i + 1,
        });
      }
    }
    
    return guests;
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setError(null);
    setResult(null);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const guests = parseCSV(text);
        if (guests.length === 0) {
          setError('No valid guests found in CSV. Make sure to include a "name" column.');
        } else {
          setPreview(guests.slice(0, 10)); // Show first 10 for preview
        }
      } catch (err) {
        setError('Failed to parse CSV file. Please check the format.');
      }
    };
    reader.readAsText(selectedFile);
  }, [parseCSV]);

  const handleImport = useCallback(async () => {
    if (!file) return;
    
    setImporting(true);
    setError(null);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const guests = parseCSV(text);
      
      try {
        const res = await fetch(`/api/events/${eventId}/guests/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(guests),
        });
        
        const data = await res.json();
        
        if (res.ok) {
          setResult({
            imported: data.imported || 0,
            skipped: data.skipped || 0,
            errors: data.errors?.map((e: { index: number; message: string }) => 
              `Row ${e.index + 1}: ${e.message}`
            ) || [],
          });
          onSuccess();
        } else {
          setError(data.error || 'Failed to import guests');
        }
      } catch (err) {
        setError('Network error. Please try again.');
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  }, [file, eventId, onSuccess, parseCSV]);

  const downloadTemplate = () => {
    const csv = 'name,email,phone,notes\n"John Doe",john@example.com,"(555) 123-4567","VIP guest"\n"Jane Smith",jane@example.com,"(555) 987-6543","Vegetarian"\n"Bob Wilson",,,"+1 welcome"';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'guest-import-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFile(null);
    setPreview([]);
    setResult(null);
    setError(null);
  };

  return (
    <Modal open={open} onClose={onClose} title="Import Guests from CSV">
      <div className="space-y-4">
        {!result && (
          <>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">CSV Format</h4>
              <p className="text-sm text-blue-700 mb-3">
                Your CSV should have columns: <strong>name, email, phone, notes</strong>
              </p>
              <button
                onClick={downloadTemplate}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
              >
                <Download className="h-4 w-4" />
                Download template
              </button>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="h-8 w-8 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">
                  {file ? file.name : 'Click to upload CSV file'}
                </span>
                <span className="text-xs text-gray-500">
                  or drag and drop
                </span>
              </label>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {preview.length > 0 && (
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <p className="text-sm font-medium text-gray-700">
                    Preview ({preview.length} of {preview.length}+ guests)
                  </p>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">Name</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">Email</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">Phone</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {preview.map((guest, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2 font-medium text-gray-900">{guest.name}</td>
                          <td className="px-4 py-2 text-gray-600">{guest.email || '-'}</td>
                          <td className="px-4 py-2 text-gray-600">{guest.phone || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                loading={importing}
                disabled={!file || preview.length === 0}
              >
                Import {preview.length > 0 && `(${preview.length}+ guests)`}
              </Button>
            </div>
          </>
        )}

        {result && (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
              <Check className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <h4 className="text-lg font-semibold text-green-900">Import Complete!</h4>
              <p className="text-green-700 mt-1">
                {result.imported} guests imported successfully
              </p>
              {result.skipped > 0 && (
                <p className="text-amber-600 text-sm mt-1">
                  {result.skipped} duplicates skipped
                </p>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                <h5 className="text-sm font-semibold text-amber-900 mb-2">
                  Warnings ({result.errors.length})
                </h5>
                <ul className="text-sm text-amber-700 space-y-1 max-h-32 overflow-y-auto">
                  {result.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                  {result.errors.length > 5 && (
                    <li>... and {result.errors.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }}>
                Close
              </Button>
              <Button onClick={reset}>
                Import Another File
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
