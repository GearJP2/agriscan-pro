import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, AlertTriangle, CheckCircle2, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { sampleAPI } from '@/lib/api';
import { parseResearchDataFile, ParsedSampleWithResults } from '@/lib/dataImport';
import { Sample, ProcessLog } from '@/types/sample';

interface AdvancedImportFormProps {
  onSuccess?: () => void;
}

const AdvancedImportForm = ({ onSuccess }: AdvancedImportFormProps) => {
  const [open, setOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string[][]>([]);
  const [parseError, setParseError] = useState('');
  const [parsedData, setParsedData] = useState<ParsedSampleWithResults[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'reviewing' | 'importing' | 'success'>('idle');
  const [showMycotoxins, setShowMycotoxins] = useState(true);

  const parseFileData = (file: File): Promise<string[][]> => {
    return new Promise((resolve, reject) => {
      const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

      if (isXlsx) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1 });
            resolve(jsonData);
          } catch (error) {
            reject(new Error('Failed to parse Excel file'));
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());
          const parsed = lines.map(line => {
            const cells: string[] = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                cells.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            cells.push(current.trim());
            return cells;
          });
          resolve(parsed);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
      }
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setParseError('');
    setParsedData([]);
    setFilePreview([]);

    if (file) {
      const validExtensions = ['.csv', '.xlsx', '.xls'];
      const isValid = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

      if (!isValid) {
        setParseError('Please upload a CSV or Excel (.xlsx, .xls) file');
        return;
      }

      setUploadFile(file);
      
      try {
        const parsed = await parseFileData(file);
        setFilePreview(parsed.slice(0, 6));
        
        // Try to parse the data
        if (parsed.length > 1) {
          const headers = parsed[0].map(h => String(h).trim());
          const rows = parsed.slice(1);
          const results = parseResearchDataFile(headers, rows);
          setParsedData(results);
          setImportStatus('reviewing');
        }
      } catch (error) {
        setParseError(error instanceof Error ? error.message : 'Failed to parse file');
      }
    }
  };

  const handleImport = async () => {
    if (parsedData.length === 0) {
      toast({
        title: 'No Data',
        description: 'No valid samples found to import.',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);
    setImportStatus('importing');

    try {
      // Create samples with their mycotoxin results
      for (const parsed of parsedData) {
        // Create sample first
        const sampleResponse = await sampleAPI.createSample(parsed.sample);
        const sampleId = sampleResponse.sample_id;

        // Add mycotoxin results
        for (const mycotoxin of parsed.mycotoxins) {
          await sampleAPI.addMycotoxinResult(sampleId, mycotoxin);
        }
      }

      setImportStatus('success');
      toast({
        title: 'Import Successful',
        description: `${parsedData.length} samples with ${parsedData.reduce((sum, p) => sum + p.mycotoxins.length, 0)} test results imported successfully.`,
      });

      // Reset form
      setTimeout(() => {
        setOpen(false);
        setUploadFile(null);
        setFilePreview([]);
        setParsedData([]);
        setImportStatus('idle');
        onSuccess?.();
      }, 2000);
    } catch (error: any) {
      const errorMsg = error?.response?.data ? JSON.stringify(error.response.data) : 'Import failed';
      toast({
        title: 'Import Error',
        description: errorMsg,
        variant: 'destructive',
      });
      setImportStatus('reviewing');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) {
        setImportStatus('idle');
        setParsedData([]);
        setFilePreview([]);
      }
      setOpen(newOpen);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Advanced Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Research Data</DialogTitle>
        </DialogHeader>

        {importStatus === 'idle' && (
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">Upload Excel or CSV file</p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports files with batch sample data including mycotoxin results
              </p>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="mt-4 w-full"
              />
            </div>

            {filePreview.length > 0 && (
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Preview</p>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted">
                        {filePreview[0]?.map((header, i) => (
                          <th key={i} className="p-2 text-left">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filePreview.slice(1).map((row, i) => (
                        <tr key={i} className="border-t">
                          {row.map((cell, j) => (
                            <td key={j} className="p-2">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {parseError && (
              <div className="rounded-lg border border-danger/30 bg-danger/5 p-3">
                <p className="text-sm text-danger">{parseError}</p>
              </div>
            )}
          </div>
        )}

        {importStatus === 'reviewing' && parsedData.length > 0 && (
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">Total Samples</p>
                  <p className="text-2xl font-bold text-foreground">{parsedData.length}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">With Results</p>
                  <p className="text-2xl font-bold text-foreground">
                    {parsedData.filter(p => p.mycotoxins.length > 0).length}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">Total Results</p>
                  <p className="text-2xl font-bold text-foreground">
                    {parsedData.reduce((sum, p) => sum + p.mycotoxins.length, 0)}
                  </p>
                </div>
              </div>

              <Button
                onClick={handleImport}
                disabled={isImporting}
                className="w-full gap-2"
              >
                {isImporting && <Loader2 className="h-4 w-4 animate-spin" />}
                Import {parsedData.length} Samples
              </Button>
            </TabsContent>

            <TabsContent value="details" className="space-y-3">
              <div className="max-h-96 overflow-y-auto space-y-2">
                {parsedData.slice(0, 20).map((item, idx) => (
                  <div key={idx} className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-medium text-foreground">
                        {item.sample.additional_info || `Sample ${idx + 1}`}
                      </p>
                      {item.mycotoxins.length > 0 && (
                        <Badge variant="secondary">{item.mycotoxins.length} results</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.sample.province}, {item.sample.district} • {item.sample.vegetation_variety}
                    </p>
                    {item.mycotoxins.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {item.mycotoxins.map((tox, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            {tox.dangerous ? (
                              <AlertTriangle className="h-3 w-3 text-danger" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3 text-success" />
                            )}
                            <span>{tox.name}: {tox.intensity}/{tox.threshold} {tox.unit}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {parsedData.length > 20 && (
                <p className="text-xs text-muted-foreground text-center">
                  ... and {parsedData.length - 20} more samples
                </p>
              )}
            </TabsContent>
          </Tabs>
        )}

        {importStatus === 'success' && (
          <div className="rounded-lg border border-success/30 bg-success/5 p-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-success mb-3" />
            <p className="text-lg font-medium text-success">Import Complete!</p>
            <p className="text-sm text-muted-foreground mt-1">
              {parsedData.length} samples and {parsedData.reduce((sum, p) => sum + p.mycotoxins.length, 0)} test results have been added.
            </p>
          </div>
        )}

        {importStatus === 'importing' && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary mb-3" />
              <p className="text-sm font-medium text-foreground">Importing data...</p>
              <p className="text-xs text-muted-foreground mt-1">Please wait while samples are being created.</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AdvancedImportForm;
