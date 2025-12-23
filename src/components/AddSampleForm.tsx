import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { regions, vegetationTypes } from '@/data/mockSamples';

const formSchema = z.object({
  region: z.string().min(1, 'Region is required'),
  province: z.string().min(1, 'Province is required').max(100),
  district: z.string().min(1, 'District is required').max(100),
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

const AddSampleForm = ({ onAddSample, onAddMultipleSamples }: AddSampleFormProps) => {
  const [open, setOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      region: '',
      province: '',
      district: '',
      vegetation_variety: '',
      collection_date: '',
      conducted_by: '',
      notes: '',
    },
  });

  const onSubmit = (values: FormValues) => {
    const sampleId = generateSampleId();
    const logId = generateLogId();
    const timestamp = new Date().toISOString();

    const initialLog: ProcessLog = {
      id: logId,
      timestamp,
      state: 'registered',
      notes: values.notes,
      conducted_by: values.conducted_by,
    };

    const newSample: Sample = {
      sample_id: sampleId,
      region: values.region,
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setCsvError(null);
    setCsvPreview([]);

    if (file) {
      if (!file.name.endsWith('.csv')) {
        setCsvError('Please upload a CSV file');
        return;
      }

      setCsvFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        const parsed = lines.map(line => line.split(',').map(cell => cell.trim()));
        setCsvPreview(parsed.slice(0, 6)); // Show first 5 rows + header
      };
      reader.readAsText(file);
    }
  };

  const handleCsvUpload = () => {
    if (!csvFile || csvPreview.length < 2) {
      setCsvError('Please upload a valid CSV file with data');
      return;
    }

    const conductedBy = form.getValues('conducted_by');
    if (!conductedBy) {
      setCsvError('Please enter your name before uploading');
      return;
    }

    // Expected columns: region, province, district, vegetation_variety, collection_date
    const headers = csvPreview[0].map(h => h.toLowerCase().replace(/\s+/g, '_'));
    const requiredColumns = ['region', 'province', 'district', 'vegetation_variety', 'collection_date'];
    
    const columnIndexes: Record<string, number> = {};
    for (const col of requiredColumns) {
      const index = headers.findIndex(h => h.includes(col) || h === col);
      if (index === -1) {
        setCsvError(`Missing required column: ${col}`);
        return;
      }
      columnIndexes[col] = index;
    }

    const newSamples: Sample[] = [];
    const timestamp = new Date().toISOString();

    for (let i = 1; i < csvPreview.length; i++) {
      const row = csvPreview[i];
      if (row.length < requiredColumns.length) continue;

      const sampleId = generateSampleId();
      const logId = generateLogId();

      const initialLog: ProcessLog = {
        id: logId,
        timestamp,
        state: 'registered',
        notes: 'Imported from CSV',
        conducted_by: conductedBy,
      };

      const newSample: Sample = {
        sample_id: sampleId,
        region: row[columnIndexes['region']] || '',
        province: row[columnIndexes['province']] || '',
        district: row[columnIndexes['district']] || '',
        vegetation_variety: row[columnIndexes['vegetation_variety']] || '',
        collection_date: row[columnIndexes['collection_date']] || '',
        process_logs: [initialLog],
        mycotoxin_results: [],
        status: 'pending',
      };

      newSamples.push(newSample);
    }

    if (newSamples.length === 0) {
      setCsvError('No valid data rows found in CSV');
      return;
    }

    // Read full file for all data
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      const allParsed = lines.map(line => line.split(',').map(cell => cell.trim()));
      
      const allSamples: Sample[] = [];
      for (let i = 1; i < allParsed.length; i++) {
        const row = allParsed[i];
        if (row.length < requiredColumns.length) continue;

        const sampleId = generateSampleId();
        const logId = generateLogId();

        const initialLog: ProcessLog = {
          id: logId,
          timestamp: new Date().toISOString(),
          state: 'registered',
          notes: 'Imported from CSV',
          conducted_by: conductedBy,
        };

        const sample: Sample = {
          sample_id: sampleId,
          region: row[columnIndexes['region']] || '',
          province: row[columnIndexes['province']] || '',
          district: row[columnIndexes['district']] || '',
          vegetation_variety: row[columnIndexes['vegetation_variety']] || '',
          collection_date: row[columnIndexes['collection_date']] || '',
          process_logs: [initialLog],
          mycotoxin_results: [],
          status: 'pending',
        };

        allSamples.push(sample);
      }

      onAddMultipleSamples(allSamples);
      toast({
        title: 'Samples Imported',
        description: `${allSamples.length} samples have been registered from CSV.`,
      });
      setCsvFile(null);
      setCsvPreview([]);
      form.reset();
      setOpen(false);
    };
    reader.readAsText(csvFile);
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
              CSV Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="mt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="region"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Region *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select region" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {regions.map(region => (
                              <SelectItem key={region} value={region}>
                                {region}
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="province"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Province *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter province" {...field} />
                        </FormControl>
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
                        <FormControl>
                          <Input placeholder="Enter district" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                </div>

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
                Upload a CSV file with sample data
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Required columns: region, province, district, vegetation_variety, collection_date
              </p>
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="mt-4 mx-auto max-w-xs"
              />
            </div>

            {csvError && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {csvError}
              </div>
            )}

            {csvPreview.length > 0 && (
              <div className="rounded-lg border bg-card">
                <div className="border-b bg-muted/50 px-4 py-2">
                  <p className="text-sm font-medium">Preview (first {csvPreview.length - 1} rows)</p>
                </div>
                <div className="overflow-x-auto p-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        {csvPreview[0]?.map((header, i) => (
                          <th key={i} className="px-2 py-1 text-left font-medium text-muted-foreground">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.slice(1).map((row, rowIndex) => (
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
                <Label htmlFor="csv-conducted-by">Registered By *</Label>
                <Input
                  id="csv-conducted-by"
                  placeholder="Your name"
                  value={form.watch('conducted_by')}
                  onChange={(e) => form.setValue('conducted_by', e.target.value)}
                  className="mt-1"
                />
              </div>

              <Button 
                onClick={handleCsvUpload} 
                className="w-full gap-2"
                disabled={!csvFile || csvPreview.length < 2}
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
