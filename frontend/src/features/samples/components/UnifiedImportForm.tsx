import { useState } from 'react';
import { 
  FileSpreadsheet, 
  PlusCircle, 
  Beaker, 
  Upload, 
  FileDown, 
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { sampleAPI } from '@/lib/api';
import { parseResearchDataFile } from '@/lib/dataImport';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';

interface UnifiedImportFormProps {
  sampleIds?: string[];
  onSuccess?: () => void;
}

const UnifiedImportForm = ({ sampleIds = [], onSuccess }: UnifiedImportFormProps) => {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [importMode, setImportMode] = useState<'new' | 'update'>('new');

  const downloadRegistrationTemplate = () => {
    const headers = [
      'sample_id', 
      'province', 
      'district', 
      'vegetation_variety', 
      'collection_date', 
      'purpose', 
      'sample_type', 
      'collected_by',
      'AFB1', 'DON', 'FB1', 'ZEA', 'OTA', 'T-2' // Optional results
    ];
    
    const exampleRow = [
      'S-001',
      'Bangkok',
      'Pathum Wan',
      'Corn',
      new Date().toISOString().split('T')[0],
      'routine',
      'field',
      'Staff Name',
      '', '', '', '', '', ''
    ];

    const csv = [
      headers.join(','),
      exampleRow.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `sample_registration_template.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'Template Downloaded',
      description: 'Fill in the details for new samples.',
    });
  };

  const downloadResultTemplate = () => {
    // Hidden for now but kept in code for future use: 'AFG1', 'AFG2', 'AFM1'
    const headers = ['sample_id', 'AFB1', 'DON', 'FB1', 'ZEA', 'OTA', 'T-2'];
    const rows = (sampleIds.length > 0 ? sampleIds : ['SAMPLE-ID-HERE']).map((sampleId) => {
      return [sampleId, '', '', '', '', '', ''];
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
    link.setAttribute('download', `lab_results_template_${datePart}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'Template Downloaded',
      description: 'Fill in the results for the existing sample IDs.',
    });
  };

  const toCsvFile = async (sourceFile: File): Promise<File> => {
    const lowerName = sourceFile.name.toLowerCase();
    if (lowerName.endsWith('.csv')) return sourceFile;
    
    const buffer = await sourceFile.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new Error('Excel file has no worksheet.');

    const rows: any[][] = [];
    worksheet.eachRow((row) => {
      const rowValues: any[] = [];
      if (Array.isArray(row.values)) {
        for (let i = 1; i < row.values.length; i++) {
          const val = row.values[i];
          rowValues.push(val && typeof val === 'object' && 'result' in val ? val.result : val);
        }
      }
      rows.push(rowValues);
    });

    const csvContent = Papa.unparse(rows);
    const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    return new File([csvBlob], sourceFile.name.replace(/\.[^.]+$/, '.csv'), { type: 'text/csv' });
  };

  const handleImport = async () => {
    if (!file) return;
    setIsUploading(true);

    try {
      const uploadFile = await toCsvFile(file);
      
      if (importMode === 'update') {
        const result = await sampleAPI.bulkImportResults(uploadFile);
        toast({
          title: 'Lab Results Updated',
          description: `${result.results_updated || 0} results matched and updated.`,
        });
      } else {
        // Read file content for parsing
        const text = await uploadFile.text();
        const results = Papa.parse<string[]>(text, { skipEmptyLines: true });
        const headers = results.data[0];
        const rows = results.data.slice(1);
        
        const parsed = parseResearchDataFile(headers, rows);
        const samplesToCreate = parsed.map(p => p.sample);
        
        const result = await sampleAPI.bulkCreateSamples(samplesToCreate);
        toast({
          title: 'Import Completed',
          description: `${result.length} new samples registered.`,
        });
      }

      setFile(null);
      setOpen(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Import Failed',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-primary/20 hover:border-primary/50 transition-colors">
          <Upload className="h-4 w-4 text-primary" />
          Import Data
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Unified Data Import
          </DialogTitle>
          <DialogDescription>
            Choose how you want to import your data. Supported formats: CSV, XLSX.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="new" onValueChange={(v) => setImportMode(v as 'new' | 'update')} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new" className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Register New Samples
            </TabsTrigger>
            <TabsTrigger value="update" className="gap-2">
              <Beaker className="h-4 w-4" />
              Update Lab Results
            </TabsTrigger>
          </TabsList>

          <div className="mt-6 space-y-6">
            <TabsContent value="new" className="m-0 space-y-3">
              <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">When to use this?</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Use this if you have a list of new samples, farms, or crops that are NOT yet in the system.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 border border-dashed rounded-xl flex items-center justify-between bg-muted/30">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Need a template?</p>
                  <p className="text-xs text-muted-foreground">Standardized registration format</p>
                </div>
                <Button variant="secondary" size="sm" onClick={downloadRegistrationTemplate} className="gap-2">
                  <FileDown className="h-3.5 w-3.5" />
                  Download
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="update" className="m-0 space-y-3">
              <div className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-amber-900">When to use this?</h4>
                    <p className="text-xs text-amber-700/80 mt-1">
                      Use this to add mycotoxin concentrations to samples that are already registered. 
                      Matching is done by <strong>Sample ID</strong>.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 border border-dashed rounded-xl flex items-center justify-between bg-muted/30">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Need a template?</p>
                  <p className="text-xs text-muted-foreground">Pre-filled with current Sample IDs</p>
                </div>
                <Button variant="secondary" size="sm" onClick={downloadResultTemplate} className="gap-2">
                  <FileDown className="h-3.5 w-3.5" />
                  Download
                </Button>
              </div>
            </TabsContent>

            <div className="space-y-4">
              <div 
                className="relative border-2 border-dashed rounded-xl p-8 transition-all hover:bg-accent/50 group cursor-pointer"
                onClick={() => document.getElementById('unified-file-input')?.click()}
              >
                <input
                  id="unified-file-input"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <div className="flex flex-col items-center justify-center text-center space-y-3">
                  <div className="p-4 rounded-full bg-primary/5 group-hover:bg-primary/10 transition-colors">
                    <Upload className="h-8 w-8 text-primary/40 group-hover:text-primary transition-colors" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {file ? file.name : 'Click or drag to upload file'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      CSV, XLSX, or XLS (Max 10MB)
                    </p>
                  </div>
                </div>
              </div>

              <Button 
                className="w-full h-12 text-md font-semibold gap-2 shadow-lg shadow-primary/20" 
                disabled={!file || isUploading}
                onClick={handleImport}
              >
                {isUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" />
                )}
                {isUploading ? 'Processing...' : `Confirm ${importMode === 'new' ? 'Registration' : 'Result Update'}`}
              </Button>
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default UnifiedImportForm;
