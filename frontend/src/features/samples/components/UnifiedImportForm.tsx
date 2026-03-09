import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { sampleAPI } from '@/lib/api';
import { parseResearchDataFile, ParsedSampleWithResults } from '@/lib/dataImport';
import { Sample } from '@/types/sample';
import { getAllProvinces, getRegionByProvince } from '@/data/thailandLocations';

interface UnifiedImportFormProps {
  onSuccess?: () => void;
}

const UnifiedImportForm = ({ onSuccess }: UnifiedImportFormProps) => {
  const [open, setOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string[][]>([]);
  const [parseError, setParseError] = useState('');
  const [parsedData, setParsedData] = useState<ParsedSampleWithResults[]>([]);
  const [importStatus, setImportStatus] = useState<'idle' | 'reviewing' | 'importing' | 'success'>('idle');

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

    setImportStatus('importing');

    try {
      let successCount = 0;
      let errorCount = 0;

      // Create samples with their mycotoxin results
      for (const parsed of parsedData) {
        try {
          // Create sample first - cast to avoid TypeScript enum issues
          const sampleResponse = await sampleAPI.createSample(parsed.sample as any);
          const sampleId = sampleResponse.sample_id;

          // Add mycotoxin results
          for (const mycotoxin of parsed.mycotoxins) {
            try {
              await sampleAPI.addMycotoxinResult(sampleId, mycotoxin);
            } catch (err) {
              console.error(`Failed to add mycotoxin result for ${sampleId}:`, err);
              // Continue even if mycotoxin fails
            }
          }
          successCount++;
        } catch (err) {
          console.error('Failed to create sample:', err);
          errorCount++;
        }
      }

      setImportStatus('success');
      const totalResults = parsedData.reduce((sum, p) => sum + p.mycotoxins.length, 0);
      
      toast({
        title: 'Import Complete',
        description: `${successCount} samples with ${totalResults} test results imported. ${errorCount > 0 ? `${errorCount} samples failed.` : ''}`,
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
      console.error('Import error:', error);
      const errorMsg = error?.response?.data ? JSON.stringify(error.response.data) : error?.message || 'Import failed';
      toast({
        title: 'Import Error',
        description: errorMsg,
        variant: 'destructive',
      });
      setImportStatus('reviewing');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) {
        setImportStatus('idle');
        setParsedData([]);
        setFilePreview([]);
        setUploadFile(null);
      }
      setOpen(newOpen);
    }}>
      <DialogTrigger asChild>
        <Button variant="default" className="gap-2">
          <Upload className="h-4 w-4" />
          Import Samples
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Samples</DialogTitle>
        </DialogHeader>

        {importStatus === 'idle' && (
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-dashed border-border p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">Upload CSV or Excel file</p>
              <p className="text-xs text-muted-foreground mt-1">
                Works with both simple imports and research data with mycotoxin results
              </p>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="mt-4 w-full"
              />
            </div>

            {parseError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm text-destructive">{parseError}</p>
              </div>
            )}
          </div>
        )}

        {importStatus === 'reviewing' && parsedData.length > 0 && (
          <div className="space-y-4">
            <div className="grid gap-3 grid-cols-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Total Samples</p>
                <p className="text-xl font-bold text-foreground">{parsedData.length}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">With Results</p>
                <p className="text-xl font-bold text-foreground">
                  {parsedData.filter(p => p.mycotoxins.length > 0).length}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Total Results</p>
                <p className="text-xl font-bold text-foreground">
                  {parsedData.reduce((sum, p) => sum + p.mycotoxins.length, 0)}
                </p>
              </div>
            </div>

            <Tabs defaultValue="preview" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>

              <TabsContent value="preview" className="space-y-3">
                <div className="max-h-96 overflow-y-auto border rounded-lg p-3">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted border-b">
                        {filePreview[0]?.slice(0, 8).map((header, i) => (
                          <th key={i} className="p-2 text-left font-medium">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filePreview.slice(1).map((row, i) => (
                        <tr key={i} className="border-b hover:bg-muted/50">
                          {row.slice(0, 8).map((cell, j) => (
                            <td key={j} className="p-2">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="details" className="space-y-2">
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {parsedData.slice(0, 15).map((item, idx) => (
                    <div key={idx} className="rounded-lg border border-border p-3 text-sm">
                      <div className="flex items-start justify-between mb-1">
                        <p className="font-medium text-foreground">
                          {item.sample.additional_info || `${item.sample.province}, ${item.sample.district}`}
                        </p>
                        {item.mycotoxins.length > 0 && (
                          <Badge variant="secondary" className="text-xs">{item.mycotoxins.length} tests</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.sample.vegetation_variety}
                      </p>
                      {item.mycotoxins.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {item.mycotoxins.map((tox, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              {tox.dangerous ? (
                                <AlertTriangle className="h-3 w-3 text-red-500" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                              )}
                              <span>{tox.name}: {tox.intensity}/{tox.threshold}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {parsedData.length > 15 && (
                  <p className="text-xs text-muted-foreground text-center">
                    ... and {parsedData.length - 15} more samples
                  </p>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setImportStatus('idle');
                  setUploadFile(null);
                  setParsedData([]);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={parsedData.length === 0}
                className="flex-1 gap-2"
              >
                <Upload className="h-4 w-4" />
                Import {parsedData.length} Samples
              </Button>
            </div>
          </div>
        )}

        {importStatus === 'importing' && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-sm font-medium text-foreground">Importing samples...</p>
              <p className="text-xs text-muted-foreground mt-1">This may take a moment.</p>
            </div>
          </div>
        )}

        {importStatus === 'success' && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-600 mb-3" />
            <p className="text-lg font-semibold text-green-900">Import Successful!</p>
            <p className="text-sm text-green-800 mt-2">
              {parsedData.length} samples with {parsedData.reduce((sum, p) => sum + p.mycotoxins.length, 0)} test results have been added.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UnifiedImportForm;
