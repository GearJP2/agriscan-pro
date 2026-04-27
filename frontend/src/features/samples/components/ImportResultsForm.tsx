import { useState } from 'react';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { FileDown, FileUp, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { sampleAPI } from '@/lib/api';

interface ImportResultsFormProps {
  sampleIds: string[];
  onSuccess?: () => void;
}

const ImportResultsForm = ({ sampleIds, onSuccess }: ImportResultsFormProps) => {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const downloadTemplate = () => {
    const headers = ['sample_id', 'AFB1', 'DON', 'FB1', 'ZEA', 'OTA', 'T-2', 'AFG1', 'AFG2', 'AFM1'];
    const rows = (sampleIds.length > 0 ? sampleIds : ['SAMPLE-ID-HERE']).map((sampleId) => {
      return [sampleId, '', '', '', '', '', '', '', '', ''];
    });

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const datePart = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `mycotoxin_results_template_${datePart}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'Template Downloaded',
      description: `Downloaded template with ${rows.length} sample row${rows.length === 1 ? '' : 's'}.`,
    });
  };

  const toCsvUploadFile = async (sourceFile: File): Promise<File> => {
    const lowerName = sourceFile.name.toLowerCase();
    if (lowerName.endsWith('.csv')) {
      return sourceFile;
    }

    if (!(lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls'))) {
      throw new Error('Unsupported file type. Please upload CSV, XLSX, or XLS.');
    }

    const formatCellValue = (value: unknown): string => {
      if (value instanceof Date) {
        const m = value.getMonth() + 1;
        const d = value.getDate();
        const y = value.getFullYear();
        const h = value.getHours();
        const min = String(value.getMinutes()).padStart(2, '0');
        return `${m}/${d}/${y} ${h}:${min}`;
      }
      // ExcelJS RichTextValue: { richText: [{text: '...'}] }
      if (value !== null && typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        if (Array.isArray(obj.richText)) {
          return (obj.richText as Array<{text?: unknown}>).map(r => String(r.text ?? '')).join('');
        }
        // Formula cell: { formula: '...', result: ... }
        if ('result' in obj) return String(obj.result ?? '');
        // Hyperlink cell: { text: '...', hyperlink: '...' }
        if ('text' in obj) return String(obj.text ?? '');
      }
      return String(value ?? '');
    };

    const buffer = await sourceFile.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('Excel file has no worksheet.');
    }

    const rows: string[][] = [];
    worksheet.eachRow((row) => {
      const rowValues: string[] = [];
      if (Array.isArray(row.values)) {
        for (let i = 1; i < row.values.length; i++) {
          rowValues.push(formatCellValue(row.values[i]));
        }
      }
      rows.push(rowValues);
    });

    const csvContent = Papa.unparse(rows);
    const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const baseName = sourceFile.name.replace(/\.(xlsx|xls)$/i, '');
    return new File([csvBlob], `${baseName}.csv`, { type: 'text/csv' });
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: 'No File Selected',
        description: 'Please select a result file first.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      const uploadFile = await toCsvUploadFile(file);
      const result = await sampleAPI.bulkImportResults(uploadFile);
      const unmatchedCount = result.unmatched_sample_ids?.length || 0;
      const baseMessage = `${result.results_created || 0} created, ${result.results_updated || 0} updated across ${result.matched_samples || 0} sample(s).`;
      const unmatchedPreview = (result.unmatched_sample_ids || []).slice(0, 5).join(', ');

      toast({
        title: unmatchedCount > 0 ? 'Import Completed with Warnings' : 'Results Imported',
        description: unmatchedCount > 0
          ? `${baseMessage} Unmatched IDs: ${unmatchedCount}${unmatchedPreview ? ` (${unmatchedPreview}${unmatchedCount > 5 ? ', ...' : ''})` : ''}.`
          : baseMessage,
        variant: unmatchedCount > 0 ? 'destructive' : 'default',
      });

      setFile(null);
      setOpen(false);
      onSuccess?.();
    } catch (error: any) {
      const detail = error?.response?.data?.detail || error?.message || 'Failed to import result file.';
      toast({
        title: 'Import Failed',
        description: detail,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileUp className="h-4 w-4" />
          Import Results
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import Mycotoxin Results</DialogTitle>
          <DialogDescription>
            Upload a completed CSV or Excel file with mycotoxin concentration results to update matching samples.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-foreground">
              1) Download template with Sample ID list
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Fill concentrations in toxin columns, keep sample_id unchanged, then upload CSV or Excel.
            </p>
            <Button type="button" variant="secondary" className="mt-3 gap-2" onClick={downloadTemplate}>
              <FileDown className="h-4 w-4" />
              Download Result Template
            </Button>
          </div>

          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-foreground">2) Upload completed result file (CSV or Excel)</p>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="mt-3 w-full text-sm"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file && (
              <p className="mt-2 text-xs text-muted-foreground">
                Selected: {file.name}
              </p>
            )}
          </div>

          <Button type="button" className="w-full gap-2" onClick={handleUpload} disabled={isUploading || !file}>
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isUploading ? 'Importing...' : 'Import Results'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportResultsForm;
