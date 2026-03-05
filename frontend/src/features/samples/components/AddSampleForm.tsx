import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as XLSX from 'xlsx';
import { Upload, FileText, Plus, Check, AlertCircle, Download, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
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
import { useAuth } from '@/contexts/AuthContext';
import { Sample, ProcessLog, PROCESSING_TYPES, PROCESSING_TYPE_LABELS, ProcessingType } from '@/types/sample';
import { vegetationTypes } from '@/data/mockSamples';
import { getAllProvinces, getDistrictsByProvince, getRegionByProvince } from '@/data/thailandLocations';

const formSchema = z.object({
  province: z.string().min(1, 'Province is required'),
  district: z.string().min(1, 'District is required'),
  vegetation_variety: z.string().min(1, 'Vegetation variety is required'),
  collection_date: z.date({
    required_error: "Collection date is required",
  }),
  purpose: z.enum(['routine', 'complaint driven', 'target surveillance'], { required_error: 'Purpose is required' }),
  sample_type: z.enum(['field', 'market', 'storage', 'export'], { required_error: 'Sample type is required' }),
  processing_type: z.enum(['raw', 'dried', 'milled', 'processed', 'fermented']).optional(),
  collected_by: z.string().min(1, 'Collector name is required'),
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
  const { isAuthenticated } = useAuth();
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
      // @ts-ignore
      collection_date: undefined,
      purpose: 'routine',
      sample_type: 'field',
      processing_type: undefined,
      collected_by: '',
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

    // Convert Date object to YYYY-MM-DD
    const formattedDate = format(values.collection_date, 'yyyy-MM-dd');

    const region = getRegionByProvince(values.province) || 'Unknown';

    const initialLog: ProcessLog = {
      id: logId,
      timestamp,
      state: 'registered',
      notes: values.notes,
      conducted_by: 'Automated by system',
    };

    const newSample: Sample = {
      sample_id: sampleId,
      region,
      province: values.province,
      district: values.district,
      vegetation_variety: values.vegetation_variety,
      collection_date: formattedDate,
      process_logs: [initialLog],
      mycotoxin_results: [],
      status: 'pending',
      purpose: values.purpose,
      sample_type: values.sample_type,
      processing_type: values.processing_type as ProcessingType | undefined,
      collected_by: values.collected_by,
      additional_info: values.notes,
    };

    onAddSample(newSample);
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
              if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
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

    // Conducted by is now automated, so we remove the check


    const headers = filePreview[0].map(h => cleanText(h).toLowerCase().replace(/\s+/g, '_'));
    const requiredColumns = ['province', 'district', 'variety', 'collection_date'];

    // Check if optional columns exist, if not we will use defaults
    const optionalColumns = ['purpose', 'sample_type', 'collected_by', 'additional_info', 'processing_type', 'sample_name', 'varieties', 'provinces', 'districts'];

    const columnIndexes: Record<string, number> = {};

    // Helper to find column index with aliases
    const findColumnIndex = (aliases: string[]) => {
      return headers.findIndex(h => aliases.some(alias => h.includes(alias) || h === alias));
    };

    // Map required columns with aliases
    const provinceIndex = findColumnIndex(['province', 'provinces']);
    const districtIndex = findColumnIndex(['district', 'districts']);
    const varietyIndex = findColumnIndex(['vegetation_variety', 'variety', 'varieties', 'crops']); // Added crops as fallback for variety
    const dateIndex = findColumnIndex(['collection_date', 'date', 'crop_year', 'year']);

    if (provinceIndex === -1) { setFileError('Missing required column: Province'); return; }
    if (districtIndex === -1) { setFileError('Missing required column: District'); return; }
    // if (varietyIndex === -1) { setFileError('Missing required column: Variety'); return; } // Make variety optional? No, core field.

    columnIndexes['province'] = provinceIndex;
    columnIndexes['district'] = districtIndex;
    columnIndexes['vegetation_variety'] = varietyIndex;
    columnIndexes['collection_date'] = dateIndex; // Can be -1

    // Map optional columns
    columnIndexes['purpose'] = findColumnIndex(['purpose']);
    columnIndexes['sample_type'] = findColumnIndex(['sample_type', 'processing_type']); // Map processing type to sample type? Or just info?
    columnIndexes['collected_by'] = findColumnIndex(['collected_by', 'collector']);
    columnIndexes['additional_info'] = findColumnIndex(['additional_info', 'notes', 'sample_name']); // Map sample name to info for now
    columnIndexes['processing_type'] = findColumnIndex(['processing_type']);
    columnIndexes['sample_name'] = findColumnIndex(['sample_name', 'sample_names']);

    try {
      const allParsed = await parseFileData(uploadFile);

      const allSamples: Sample[] = [];
      for (let i = 1; i < allParsed.length; i++) {
        const row = allParsed[i];
        if (Object.keys(columnIndexes).some(key => columnIndexes[key] >= row.length)) continue;

        const sampleId = generateSampleId();
        const logId = generateLogId();
        const province = cleanText(row[columnIndexes['province']] || '');
        const region = getRegionByProvince(province) || 'Unknown';

        const rawDate = dateIndex !== -1 ? cleanText(row[columnIndexes['collection_date']] || '') : '';
        let formattedDate = new Date().toISOString().split('T')[0]; // Default to today

        if (rawDate) {
          // Handle d/m/y format (e.g. 31/01/2024 -> 2024-01-31)
          if (rawDate.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
            const [day, month, year] = rawDate.split('/');
            formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          } else if (rawDate.match(/^\d{4}$/)) {
            // Handle year only
            formattedDate = `${rawDate}-01-01`;
          } else {
            // Try standard parse
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
              formattedDate = d.toISOString().split('T')[0];
            }
          }
        }

        const additionalInfo = columnIndexes['additional_info'] !== undefined ? cleanText(row[columnIndexes['additional_info']] || '') : '';

        const initialLog: ProcessLog = {
          id: logId,
          timestamp: new Date().toISOString(),
          state: 'registered',
          notes: `Imported from ${uploadFile.name.endsWith('.csv') ? 'CSV' : 'Excel'}. ${additionalInfo} ${columnIndexes['sample_name'] !== -1 ? `Sample Name: ${cleanText(row[columnIndexes['sample_name']] || '')}` : ''
            }`,
          conducted_by: 'Automated by system',
        };

        const sample: Sample = {
          sample_id: sampleId,
          region,
          province,
          district: cleanText(row[columnIndexes['district']] || ''),
          vegetation_variety: cleanText(row[columnIndexes['vegetation_variety']] || ''),
          collection_date: formattedDate,
          process_logs: [initialLog],
          mycotoxin_results: [],
          status: 'pending',
          purpose: (columnIndexes['purpose'] !== undefined ? cleanText(row[columnIndexes['purpose']] || '') : 'routine') as any,
          sample_type: (columnIndexes['sample_type'] !== undefined ? cleanText(row[columnIndexes['sample_type']] || '') : 'field') as any,
          collected_by: columnIndexes['collected_by'] !== undefined ? cleanText(row[columnIndexes['collected_by']] || '') : 'Imported',
          additional_info: additionalInfo,
        };

        allSamples.push(sample);
      }

      onAddMultipleSamples(allSamples);
      setUploadFile(null);
      setFilePreview([]);
      form.reset();
      setOpen(false);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Failed to import samples');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (newOpen && !isAuthenticated) {
        window.dispatchEvent(new CustomEvent('open-login-modal'));
        return;
      }
      setOpen(newOpen);
    }}>
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
                      <FormItem className="flex flex-col">
                        <FormLabel>Collection Date *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="purpose"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purpose *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select purpose" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="routine">Routine</SelectItem>
                            <SelectItem value="complaint driven">Complaint Driven</SelectItem>
                            <SelectItem value="target surveillance">Target Surveillance</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sample_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sample Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="field">Field</SelectItem>
                            <SelectItem value="market">Market</SelectItem>
                            <SelectItem value="storage">Storage</SelectItem>
                            <SelectItem value="export">Export</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Processing Type */}
                <FormField
                  control={form.control}
                  name="processing_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Processing Type (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select processing type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PROCESSING_TYPES.map(type => (
                            <SelectItem key={type} value={type}>
                              {PROCESSING_TYPE_LABELS[type]}
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
                  name="collected_by"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Collected By *</FormLabel>
                      <FormControl>
                        <Input placeholder="Collector's name" {...field} />
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
                Required columns: Provinces, Districts, Varieties, Date. <br />
                Optional: Purpose, Processing Type, Collected By, Sample Names, Mycotoxins (DON, ZEA...), Metals
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 gap-2 h-8"
                onClick={() => {
                  const headers = [
                    'Regions', 'Crops', 'Processing type', 'Varieties', 'Provinces', 'Districts', 'Positive/Negative', 'Sample names',
                    'DON', 'AFB1', 'FB1', 'T-2', 'ZEA', 'OTA',
                    'Mg', 'Al', 'P', 'K', 'Li', 'Be', 'Ca', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'As', 'Rb', 'Sr', 'Y', 'Mo', 'Ag', 'Cd', 'Sn', 'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd', 'Sm', 'Eu', 'Gd', 'Tl', 'Pb', 'Th', 'U',
                    'd 13C', 'd 15N', 'd 18O',
                    'Date (DD/MM/YYYY)', 'Purpose', 'Collected By'
                  ];

                  const mockRow = [
                    'North', 'Corn', 'Dried', 'Sweet Corn', 'Chiang Mai', 'Mueang', 'Negative', 'SMP-2024-001',
                    '<LOQ', '<LOQ', '<LOQ', '<LOQ', '<LOQ', '<LOQ',
                    '150.5', '20.1', '350.2', '420.5', '0.05', '0.01', '120.5', '0.45', '0.12', '1.5', '12.8', '45.2', '0.3', '1.8', '5.5', '12.4', '0.05', '1.2', '2.5', '0.1', '0.08', '0.01', '0.02', '0.05', '0.01', '5.2', '0.3', '0.6', '0.1', '0.4', '0.08', '0.02', '0.09', '0.01', '0.05', '0.02', '0.01',
                    '-25.4', '4.8', '-5.2',
                    '01/01/2024', 'routine', 'System Admin'
                  ];

                  const csvContent = [headers.join(','), mockRow.join(',')].join('\n');
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement('a');
                  link.href = URL.createObjectURL(blob);
                  link.setAttribute('download', 'agriscan_template.csv');
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
              >
                <Download className="h-3 w-3" />
                Download Template
              </Button>
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
              <div className="bg-muted/30 p-3 rounded text-xs text-muted-foreground">
                <p className="flex items-center gap-1"><Check className="h-3 w-3" /> Registered By will be set to "Automated by system"</p>
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
