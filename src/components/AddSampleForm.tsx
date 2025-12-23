import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as XLSX from 'xlsx';
import { Upload, FileText, Plus, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Sample, ProcessLog } from '@/types/sample';
import { vegetationTypes } from '@/data/mockSamples';
import { getAllProvinces, getDistrictsByProvince, getRegionByProvince } from '@/data/thailandLocations';

const formSchema = z.object({
  province: z.string().min(1, 'Province is required'),
  district: z.string().min(1, 'District is required'),
  vegetation_variety: z.string().min(1, 'Vegetation variety is required'),
  collection_date: z.string().min(1, 'Collection date is required'),
  conducted_by: z.string().min(1, 'Your name is required').max(100),
  notes: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AddSampleFormProps {
  onAddSample: (sample: Sample) => void;
  onAddMultipleSamples: (samples: Sample[]) => void;
}

const generateSampleId = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `SAM-${year}-${random}`;
};

const generateLogId = () => {
  return `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
};

// Clean text by removing surrounding quotes
const cleanText = (text: string): string => {
  if (!text) return '';
  return text.trim().replace(/^["']|["']$/g, '').trim();
};

const AddSampleForm = ({ onAddSample, onAddMultipleSamples }: AddSampleFormProps) => {
  const [open, setOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string[][]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);

  const provinces = getAllProvinces();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      province: '',
      district: '',
      vegetation_variety: '',
      collection_date: '',
      conducted_by: '',
      notes: '',
    },
  });

  const selectedProvince = form.watch('province');

  // Update districts when province changes
  useEffect(() => {
    if (selectedProvince) {
      const districts = getDistrictsByProvince(selectedProvince);
      setAvailableDistricts(districts);
      // Reset district if it's not in the new list
      const currentDistrict = form.getValues('district');
      if (currentDistrict && !districts.includes(currentDistrict)) {
        form.setValue('district', '');
      }
    } else {
      setAvailableDistricts([]);
    }
  }, [selectedProvince, form]);

  const onSubmit = (values: FormValues) => {
    const sampleId = generateSampleId();
    const logId = generateLogId();
    const timestamp = new Date().toISOString();
    const region = getRegionByProvince(values.province) || 'Unknown';

    const initialLog: ProcessLog = {
      id: logId,
      timestamp,
      state: 'registered',
      notes: values.notes,
      conducted_by: values.conducted_by,
    };

    const newSample: Sample = {
      sample_id: sampleId,
      region,
      province: values.province,
      district: values.district,
      vegetation_variety: values.vegetation_variety,
      collection_date: values.collection_date,
      process_logs: [initialLog],
      mycotoxin_results: [],
      status: 'pending',
    };

    onAddSample(newSample);
    toast({
      title: 'Sample Registered',
      description: `Sample ${sampleId} has been registered successfully.`,
    });
    form.reset();
    setOpen(false);
  };

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
            // Clean quotes from all cells
            const cleanedData = jsonData.map(row => 
              row.map(cell => cleanText(String(cell ?? '')))
            );
            resolve(cleanedData);
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
          // Parse CSV properly handling quoted values
          const parsed = lines.map(line => {
            const cells: string[] = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"' && (i === 0 || line[i-1] !== '\\')) {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                cells.push(cleanText(current));
                current = '';
              } else {
                current += char;
              }
            }
            cells.push(cleanText(current));
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
    setFileError(null);
    setFilePreview([]);

    if (file) {
      const validExtensions = ['.csv', '.xlsx', '.xls'];
      const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
      
      if (!hasValidExtension) {
        setFileError('Please upload a CSV or Excel (.xlsx, .xls) file');
        return;
      }

      setUploadFile(file);
      try {
        const parsed = await parseFileData(file);
        setFilePreview(parsed.slice(0, 6));
      } catch (error) {
        setFileError(error instanceof Error ? error.message : 'Failed to parse file');
      }
    }
  };

  const handleFileUpload = async () => {
    if (!uploadFile || filePreview.length < 2) {
      setFileError('Please upload a valid file with data');
      return;
    }

    const conductedBy = form.getValues('conducted_by');
    if (!conductedBy) {
      setFileError('Please enter your name before uploading');
      return;
    }

    const headers = filePreview[0].map(h => cleanText(h).toLowerCase().replace(/\s+/g, '_'));
    const requiredColumns = ['province', 'district', 'vegetation_variety', 'collection_date'];
    
    const columnIndexes: Record<string, number> = {};
    for (const col of requiredColumns) {
      const index = headers.findIndex(h => h.includes(col) || h === col);
      if (index === -1) {
        setFileError(`Missing required column: ${col}`);
        return;
      }
      columnIndexes[col] = index;
    }

    try {
      const allParsed = await parseFileData(uploadFile);
      
      const allSamples: Sample[] = [];
      for (let i = 1; i < allParsed.length; i++) {
        const row = allParsed[i];
        if (row.length < requiredColumns.length) continue;

        const sampleId = generateSampleId();
        const logId = generateLogId();
        const province = cleanText(row[columnIndexes['province']] || '');
        const region = getRegionByProvince(province) || 'Unknown';

        const initialLog: ProcessLog = {
          id: logId,
          timestamp: new Date().toISOString(),
          state: 'registered',
          notes: `Imported from ${uploadFile.name.endsWith('.csv') ? 'CSV' : 'Excel'}`,
          conducted_by: conductedBy,
        };

        const sample: Sample = {
          sample_id: sampleId,
          region,
          province,
          district: cleanText(row[columnIndexes['district']] || ''),
          vegetation_variety: cleanText(row[columnIndexes['vegetation_variety']] || ''),
          collection_date: cleanText(row[columnIndexes['collection_date']] || ''),
          process_logs: [initialLog],
          mycotoxin_results: [],
          status: 'pending',
        };

        allSamples.push(sample);
      }

      onAddMultipleSamples(allSamples);
      toast({
        title: 'Samples Imported',
        description: `${allSamples.length} samples have been registered.`,
      });
      setUploadFile(null);
      setFilePreview([]);
      form.reset();
      setOpen(false);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Failed to import samples');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Sample
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register New Sample</DialogTitle>
          <DialogDescription>
            Add a new sample manually or import multiple samples from a CSV file.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="manual" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual" className="gap-2">
              <FileText className="h-4 w-4" />
              Manual Entry
            </TabsTrigger>
            <TabsTrigger value="csv" className="gap-2">
              <Upload className="h-4 w-4" />
              File Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="mt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="province"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Province *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select province" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[300px]">
                            {provinces.map(province => (
                              <SelectItem key={province} value={province}>
                                {province}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="district"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>District *</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                          disabled={!selectedProvince}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={selectedProvince ? "Select district" : "Select province first"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[300px]">
                            {availableDistricts.map(district => (
                              <SelectItem key={district} value={district}>
                                {district}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="vegetation_variety"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vegetation Variety *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select variety" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {vegetationTypes.map(type => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="collection_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Collection Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="conducted_by"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registered By *</FormLabel>
                      <FormControl>
                        <Input placeholder="Your name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Any additional notes about the sample..."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full gap-2">
                  <Check className="h-4 w-4" />
                  Register Sample
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="csv" className="mt-6 space-y-4">
            <div className="rounded-lg border-2 border-dashed border-border p-6 text-center">
              <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                Upload a CSV or Excel file with sample data
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Required columns: province, district, vegetation_variety, collection_date
              </p>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="mt-4 mx-auto max-w-xs"
              />
            </div>

            {fileError && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {fileError}
              </div>
            )}

            {filePreview.length > 0 && (
              <div className="rounded-lg border bg-card">
                <div className="border-b bg-muted/50 px-4 py-2">
                  <p className="text-sm font-medium">Preview (first {filePreview.length - 1} rows)</p>
                </div>
                <div className="overflow-x-auto p-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        {filePreview[0]?.map((header, i) => (
                          <th key={i} className="px-2 py-1 text-left font-medium text-muted-foreground">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filePreview.slice(1).map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b last:border-0">
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-2 py-1">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="file-conducted-by">Registered By *</Label>
                <Input
                  id="file-conducted-by"
                  placeholder="Your name"
                  value={form.watch('conducted_by')}
                  onChange={(e) => form.setValue('conducted_by', e.target.value)}
                  className="mt-1"
                />
              </div>

              <Button 
                onClick={handleFileUpload} 
                className="w-full gap-2"
                disabled={!uploadFile || filePreview.length < 2}
              >
                <Upload className="h-4 w-4" />
                Import Samples
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AddSampleForm;
