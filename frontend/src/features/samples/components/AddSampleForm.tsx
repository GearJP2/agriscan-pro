import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as XLSX from 'xlsx';
import { Upload, FileText, Plus, Check, AlertCircle, Download, CalendarIcon, Loader2, Eye, EyeOff } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { sampleAPI } from '@/lib/api';
import { parseResearchDataFile } from '@/lib/dataImport';
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
  
  // Advanced import states
  const [advancedFile, setAdvancedFile] = useState<File | null>(null);
  const [advancedFilePreview, setAdvancedFilePreview] = useState<string[][]>([]);
  const [advancedFileError, setAdvancedFileError] = useState('');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'reviewing' | 'importing' | 'success'>('idle');

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
    setParsedData([]);
    setImportStatus('idle');

    if (file) {
      console.log(`[FileUpload] File selected: ${file.name} (${file.size} bytes)`);
      const validExtensions = ['.csv', '.xlsx', '.xls'];
      const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

      if (!hasValidExtension) {
        setFileError('Please upload a CSV or Excel (.xlsx, .xls) file');
        console.warn(`[FileUpload] Invalid file extension: ${file.name}`);
        return;
      }

      setUploadFile(file);
      try {
        console.log(`[FileUpload] Parsing file...`);
        const parsed = await parseFileData(file);
        console.log(`[FileUpload] File parsed successfully: ${parsed.length} rows, ${parsed[0]?.length || 0} columns`);
        setFilePreview(parsed.slice(0, 6));
      } catch (error) {
        console.error('[FileUpload] Parse error:', error);
        setFileError(error instanceof Error ? error.message : 'Failed to parse file');
      }
    }
  };

  // Fuzzy matching for column names - same as vegetation matching
  const fuzzyMatchColumn = (value: string, candidates: string[]): number => {
    if (!value) return -1;
    
    const valLower = value.toLowerCase().trim();
    
    // Try exact match first
    const exactMatch = candidates.findIndex(cand => cand.toLowerCase().trim() === valLower);
    if (exactMatch !== -1) return exactMatch;
    
    // Try substring match (contains)
    let bestMatch = -1;
    let bestScore = 0;
    
    candidates.forEach((cand, idx) => {
      const candLower = cand.toLowerCase().trim();
      
      // If header contains the search term or vice versa
      if (candLower.includes(valLower) || valLower.includes(candLower)) {
        bestScore = Math.max(bestScore, 0.8);
        if (bestScore === 0.8) bestMatch = idx;
      }
      
      // Check for key words
      if (valLower === 'province' && (candLower.includes('prov') || candLower.includes('state'))) {
        bestScore = Math.max(bestScore, 0.9);
        if (bestScore === 0.9) bestMatch = idx;
      }
      if (valLower === 'district' && (candLower.includes('dist') || candLower.includes('county') || candLower.includes('region'))) {
        bestScore = Math.max(bestScore, 0.9);
        if (bestScore === 0.9) bestMatch = idx;
      }
      if (valLower === 'vegetation_variety' && (candLower.includes('crop') || candLower.includes('variet') || candLower.includes('sample'))) {
        bestScore = Math.max(bestScore, 0.85);
        if (bestScore === 0.85) bestMatch = idx;
      }
    });
    
    return bestMatch;
  };

  const handleFileUpload = async () => {
    if (!uploadFile || filePreview.length < 2) {
      setFileError('Please upload a valid file with data');
      return;
    }

    setIsImporting(true);
    setImportStatus('reviewing');

    try {
      const allParsed = await parseFileData(uploadFile);
      const headers = allParsed[0].map(h => String(h).trim());
      const rows = allParsed.slice(1);

      console.log('[FileUpload] File headers:', headers);

      // Check if file has mycotoxin columns
      const mycotoxinColumns = ['DON', 'AFB1', 'FB1', 'T-2', 'ZEA', 'OTA'];
      const hasMycotoxins = headers.some(header => 
        mycotoxinColumns.some(tox => header.toUpperCase().includes(tox))
      );

      let parsedData: any[] = [];

      if (hasMycotoxins) {
        // Use research data parser for files with mycotoxins
        console.log('[FileUpload] Detected mycotoxin columns, using research parser');
        parsedData = parseResearchDataFile(headers, rows);
      } else {
        // Use simple file parser for basic samples
        
        // Better empty value detection
        const isEmptyValue = (value: any): boolean => {
          if (value === null || value === undefined) return true;
          const str = String(value).trim().toLowerCase();
          // Check for empty, common placeholders, and values starting with '<' (like '<LOD')
          return !str || str === '-' || str === 'n/a' || str === 'na' || str === 'none' || str === 'null' || str === '#n/a' || str.startsWith('<');
        };

        const normalizeEmptyValue = (value: any): string => {
          if (isEmptyValue(value)) return '';
          const str = String(value).trim();
          // Also treat values starting with '<' as empty (like '<LOD', '<0.1')
          if (str.startsWith('<')) return '';
          return str;
        };

        // Fuzzy column matching
        const findColumnIndex = (searchTerms: string[]): number => {
          let bestIdx = -1;
          let bestScore = 0;
          
          headers.forEach((header, idx) => {
            const headerLower = header.toLowerCase().trim();
            
            for (const term of searchTerms) {
              const termLower = term.toLowerCase().trim();
              
              // Exact match
              if (headerLower === termLower) {
                return; // Will set bestIdx = idx in exact match below
              }
              
              // Substring match
              if (headerLower.includes(termLower) || termLower.includes(headerLower)) {
                if (bestScore < 0.9) {
                  bestScore = 0.9;
                  bestIdx = idx;
                }
              }
            }
          });
          
          // Final exact match check
          const exactIdx = headers.findIndex(h => searchTerms.includes(h));
          if (exactIdx !== -1) return exactIdx;
          
          return bestIdx;
        };

        const provinceIndex = findColumnIndex(['province', 'provinces']);
        const districtIndex = findColumnIndex(['district', 'districts']);
        const varietyIndex = findColumnIndex(['vegetation_variety', 'variety', 'varieties', 'crop', 'crops']);
        const dateIndex = findColumnIndex(['collection_date', 'date', 'crop_year', 'year']);
        const regionIndex = findColumnIndex(['region', 'regions', 'state', 'states']);
        const processingTypeIndex = findColumnIndex(['processing type', 'processing_type', 'process type']);
        const sampleNameIndex = findColumnIndex(['sample name', 'sample_name', 'sample names', 'sample_id']);

        console.log('[FileUpload] Detected columns:', {
          province: provinceIndex >= 0 ? headers[provinceIndex] : 'NOT FOUND',
          district: districtIndex >= 0 ? headers[districtIndex] : 'NOT FOUND',
          vegetation_variety: varietyIndex >= 0 ? headers[varietyIndex] : 'NOT FOUND',
          date: dateIndex >= 0 ? headers[dateIndex] : 'NOT FOUND',
          region: regionIndex >= 0 ? headers[regionIndex] : 'NOT FOUND',
          processing_type: processingTypeIndex >= 0 ? headers[processingTypeIndex] : 'NOT FOUND',
          sample_name: sampleNameIndex >= 0 ? headers[sampleNameIndex] : 'NOT FOUND',
        });

        if (provinceIndex === -1) { 
          setFileError('Missing required column: Province (searched for: province, provinces)'); 
          setIsImporting(false); 
          setImportStatus('idle'); 
          console.error('[FileUpload] Available headers:', headers);
          return; 
        }
        if (districtIndex === -1) { 
          setFileError('Missing required column: District (searched for: district, districts)'); 
          setIsImporting(false); 
          setImportStatus('idle'); 
          console.error('[FileUpload] Available headers:', headers);
          return; 
        }
        if (varietyIndex === -1) {
          console.warn('[FileUpload] Vegetation variety column not found, will use sample name or default');
        }

        const columnIndexes: Record<string, number> = {
          province: provinceIndex,
          district: districtIndex,
          vegetation_variety: varietyIndex,
          collection_date: dateIndex,
          region: regionIndex,
          processing_type: processingTypeIndex,
          purpose: findColumnIndex(['purpose']),
          sample_type: findColumnIndex(['sample_type']),
          collected_by: findColumnIndex(['collected_by', 'collector']),
          additional_info: findColumnIndex(['additional_info', 'notes']),
          sample_name: sampleNameIndex,
        };

        const allSamples: Sample[] = [];
        const validSampleTypes = ['field', 'market', 'storage', 'export'];
        const validProcessingTypes = ['raw', 'dried', 'milled', 'processed', 'fermented'];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          // Skip completely empty rows
          if (!row || row.every(cell => isEmptyValue(cell))) {
            console.log(`[FileUpload] Skipping row ${i + 1}: completely empty`);
            continue;
          }

          // Safely get values with bounds checking
          const getRowValue_Current = (idx: number): string => {
            return idx >= 0 && idx < row.length ? normalizeEmptyValue(row[idx]) : '';
          };

          const province = getRowValue_Current(provinceIndex);
          const district = getRowValue_Current(districtIndex);
          let variety = varietyIndex >= 0 ? getRowValue_Current(varietyIndex) : '';

          // Validate and clean variety - reject if it's just a number (like year "2022")
          if (variety && /^\d+$/.test(variety)) {
            console.warn(`[FileUpload] Row ${i + 1}: variety is just a number (${variety}), treating as invalid`);
            variety = '';
          }

          // Skip rows missing critical required fields
          if (!province || !district) {
            console.warn(`[FileUpload] Skipping row ${i + 1}: missing province or district`, { province, district });
            continue;
          }

          // Variety is optional but warn if missing
          if (!variety) {
            console.warn(`[FileUpload] Row ${i + 1}: vegetation_variety empty or invalid, will use 'Other'`);
            variety = 'Other';
          }

          if (provinceIndex >= row.length || districtIndex >= row.length) {
            console.warn(`[FileUpload] Skipping row ${i + 1}: row is shorter than expected`);
            continue;
          }

          const sampleId = generateSampleId();
          // Try to use region column if available, otherwise derive from province
          let region = columnIndexes['region'] >= 0 
            ? getRowValue_Current(columnIndexes['region']).trim() || 'Unknown'
            : getRegionByProvince(province) || 'Unknown';

          const rawDate = dateIndex !== -1 ? getRowValue_Current(columnIndexes['collection_date']) : '';
          let formattedDate = new Date().toISOString().split('T')[0];

          if (rawDate) {
            if (rawDate.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
              const [day, month, year] = rawDate.split('/');
              formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            } else if (rawDate.match(/^\d{4}$/)) {
              formattedDate = `${rawDate}-01-01`;
            } else {
              const d = new Date(rawDate);
              if (!isNaN(d.getTime())) {
                formattedDate = d.toISOString().split('T')[0];
              }
            }
          }

          const sampleTypeRaw = columnIndexes['sample_type'] >= 0 ? getRowValue_Current(columnIndexes['sample_type']).toLowerCase() : '';
          const processingTypeRaw = columnIndexes['processing_type'] >= 0 ? getRowValue_Current(columnIndexes['processing_type']).toLowerCase() : '';

          const sample: Sample = {
            sample_id: sampleId,
            region,
            province,
            district,
            vegetation_variety: variety || 'Unknown',
            collection_date: formattedDate,
            status: 'pending',
            purpose: (columnIndexes['purpose'] >= 0 ? normalizeEmptyValue(row[columnIndexes['purpose']] || '') : '') as any,
            sample_type: (sampleTypeRaw && validSampleTypes.includes(sampleTypeRaw) ? sampleTypeRaw : '') as any,
            processing_type: (processingTypeRaw && validProcessingTypes.includes(processingTypeRaw) ? processingTypeRaw : '') as any,
            collected_by: columnIndexes['collected_by'] >= 0 ? normalizeEmptyValue(row[columnIndexes['collected_by']] || '') : '',
            additional_info: columnIndexes['additional_info'] >= 0 ? normalizeEmptyValue(row[columnIndexes['additional_info']] || '') : '',
          };

          allSamples.push(sample);
        }

        parsedData = allSamples.map(sample => ({ sample, mycotoxins: [] }));
      }

      console.log(`[FileUpload] Successfully parsed ${parsedData.length} samples`);
      
      // Log first few samples for debugging
      console.log('[FileUpload] Sample data preview (first 3):');
      parsedData.slice(0, 3).forEach((p, idx) => {
        const sample = p.sample || p;
        console.log(`  Sample ${idx + 1}:`, {
          sample_id: sample.sample_id,
          region: sample.region,
          province: sample.province,
          district: sample.district,
          vegetation_variety: sample.vegetation_variety,
          collection_date: sample.collection_date,
        });
      });
      
      setParsedData(parsedData);
      setImportStatus('reviewing');
      setIsImporting(false); // Reset importing state after parsing completes
    } catch (error) {
      console.error('[FileUpload] File import error:', error);
      setFileError(error instanceof Error ? error.message : 'Failed to import file');
      setImportStatus('idle');
      setIsImporting(false);
    }
  };

  const handleImportReview = async () => {
    if (parsedData.length === 0) {
      toast({
        title: 'No Data',
        description: 'No valid samples found to import.',
        variant: 'destructive',
      });
      return;
    }

    console.log(`[Import] Starting import of ${parsedData.length} samples`);
    
    // Pre-validation: check for common issues before importing
    console.log('[Import] Running pre-import validation...');
    const validationErrors: string[] = [];
    let invalidCount = 0;
    
    const isEmptyValue = (value: any): boolean => {
      if (value === null || value === undefined) return true;
      const str = String(value).trim().toLowerCase();
      return !str || str === '-' || str === 'n/a' || str === 'na' || str === 'none' || str === 'null' || str === '#n/a';
    };
    
    parsedData.forEach((parsed, index) => {
      const sample = parsed.sample || parsed;
      const rowNum = index + 1;
      
      // Check required fields
      if (isEmptyValue(sample.sample_id)) {
        validationErrors.push(`Row ${rowNum}: Missing or empty sample_id`);
        invalidCount++;
      }
      if (isEmptyValue(sample.province)) {
        validationErrors.push(`Row ${rowNum}: Missing or empty province`);
        invalidCount++;
      }
      if (isEmptyValue(sample.district)) {
        validationErrors.push(`Row ${rowNum}: Missing or empty district`);
        invalidCount++;
      }
      if (isEmptyValue(sample.vegetation_variety)) {
        validationErrors.push(`Row ${rowNum}: Missing or empty vegetation_variety`);
        invalidCount++;
      }
      
      // Check date format
      if (sample.collection_date && !sample.collection_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        validationErrors.push(`Row ${rowNum}: Invalid date format "${sample.collection_date}" (must be YYYY-MM-DD)`);
        invalidCount++;
      }
    });
    
    if (invalidCount > 0) {
      console.warn(`[Import] Found ${invalidCount} validation errors:`, validationErrors.slice(0, 10));
      toast({
        title: 'Validation Errors Found',
        description: `${invalidCount} samples have validation errors. First error: ${validationErrors[0]}. Check console for details.`,
        variant: 'destructive',
      });
      setIsImporting(false);
      return;
    }
    
    console.log('[Import] Pre-validation passed');
    setIsImporting(true);
    setImportStatus('importing');

    try {
      let successCount = 0;
      const errors: string[] = [];
      const failureDetails: any[] = []; // Track detailed failure info

      for (let i = 0; i < parsedData.length; i++) {
        let parsed: any = null; // Declare outside try-catch for catch block access
        try {
          parsed = parsedData[i];
          const sample = parsed.sample || parsed;
          
          // Log first 5 samples for debugging
          if (i < 5) {
            console.log(`[Import] Sample ${i + 1} data:`, {
              sample_id: sample.sample_id,
              region: sample.region,
              province: sample.province,
              district: sample.district,
              vegetation_variety: sample.vegetation_variety,
              collection_date: sample.collection_date,
            });
          }
          
          console.log(`[Import] Processing sample ${i + 1}:`, sample.sample_id);
          
          // Validate sample has required fields
          if (!sample.sample_id || !sample.province || !sample.district || !sample.vegetation_variety) {
            errors.push(`Row ${i + 1}: Missing required fields`);
            console.warn(`[Import] Row ${i + 1} missing required fields`);
            continue;
          }
          
          if (parsed.mycotoxins && parsed.mycotoxins.length > 0) {
            // Has mycotoxin results - create sample and link tests
            console.log(`[Import] Creating sample with ${parsed.mycotoxins.length} mycotoxin results`);
            const sampleResponse = await sampleAPI.createSample(sample as any);
            const sampleId = sampleResponse.sample_id;
            console.log(`[Import] Sample created: ${sampleId}`);

            for (const mycotoxin of parsed.mycotoxins) {
              try {
                await sampleAPI.addMycotoxinResult(sampleId, mycotoxin);
              } catch (err) {
                console.error(`Failed to add mycotoxin result for ${sampleId}:`, err);
                errors.push(`Row ${i + 1}: Failed to add test result`);
              }
            }
            successCount++;
          } else {
            // Simple sample without toxins
            console.log(`[Import] Creating simple sample`);
            await sampleAPI.createSample(sample as any);
            successCount++;
          }
          console.log(`[Import] Sample ${i + 1} completed successfully`);
        } catch (err: any) {
          console.error(`[Import] Failed to create sample at row ${i + 1}:`, err);
          // Extract detailed error message from backend
          let errorMsg = 'Failed to create sample';
          if (err?.response?.data) {
            const data = err.response.data;
            // Handle both detail and field-specific errors
            if (typeof data === 'object') {
              const messages = Object.entries(data)
                .map(([key, value]: [string, any]) => {
                  if (Array.isArray(value)) {
                    return `${key}: ${value.join(', ')}`;
                  }
                  return `${key}: ${value}`;
                })
                .join('; ');
              errorMsg = messages || data.detail || 'Validation failed';
            } else {
              errorMsg = String(data);
            }
          } else if (err?.message) {
            errorMsg = err.message;
          }
          console.error(`[Import] Error details for row ${i + 1}:`, errorMsg);
          // parsed is now accessible here since it's declared outside try-catch
          if (parsed) {
            const sample = parsed.sample || parsed;
            const failureData = {
              sample_id: sample.sample_id,
              region: sample.region,
              province: sample.province,
              district: sample.district,
              vegetation_variety: sample.vegetation_variety,
              collection_date: sample.collection_date,
              error: errorMsg,
            };
            console.warn(`[Import] Failed sample data:`, failureData);
            
            // Keep track of first 10 failures for debugging
            if (failureDetails.length < 10) {
              failureDetails.push({ row: i + 1, ...failureData });
            }
          }
          errors.push(`Row ${i + 1}: ${errorMsg}`);
        }
      }

      console.log(`[Import] Loop complete. Successful: ${successCount}/${parsedData.length}`);
      
      // Show first 10 failures for debugging
      if (failureDetails.length > 0) {
        console.log(`[Import] First ${failureDetails.length} failures:`, failureDetails);
      }

      // Always reset importing state
      setIsImporting(false);

      if (successCount > 0) {
        setImportStatus('success');
        const totalToxins = parsedData.reduce((sum: number, p: any) => sum + (p.mycotoxins?.length || 0), 0);

        toast({
          title: 'Import Complete',
          description: `${successCount} of ${parsedData.length} samples imported${totalToxins > 0 ? ` with ${totalToxins} test results` : ''}.`,
        });

        setTimeout(() => {
          setOpen(false);
          setUploadFile(null);
          setFilePreview([]);
          setParsedData([]);
          setImportStatus('idle');
          form.reset();
        }, 2000);
      } else {
        // All samples failed
        setImportStatus('reviewing');
        console.error(`[Import] All samples failed. Errors: `, errors);
        toast({
          title: 'Import Failed',
          description: errors.slice(0, 3).join('\n') + (errors.length > 3 ? `\n... and ${errors.length - 3} more errors` : ''),
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('[Import] Unexpected import error:', error);
      setIsImporting(false);
      setImportStatus('reviewing');
      toast({
        title: 'Import Error',
        description: error?.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  };

  const parseAdvancedFileData = (file: File): Promise<string[][]> => {
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

  const handleAdvancedFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError('');
    setParsedData([]);
    setFilePreview([]);

    if (file) {
      const validExtensions = ['.csv', '.xlsx', '.xls'];
      const isValid = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

      if (!isValid) {
        setFileError('Please upload a CSV or Excel (.xlsx, .xls) file');
        return;
      }

      setUploadFile(file);

      try {
        const parsed = await parseFileData(file);
        setFilePreview(parsed.slice(0, 6));
        
        // Auto-parse the file
        if (parsed.length > 1) {
          const headers = parsed[0].map(h => String(h).trim());
          const rows = parsed.slice(1);
          
          // Check if has mycotoxins
          const mycotoxinColumns = ['DON', 'AFB1', 'FB1', 'T-2', 'ZEA', 'OTA'];
          const hasMycotoxins = headers.some(header => 
            mycotoxinColumns.some(tox => header.toUpperCase().includes(tox))
          );

          if (hasMycotoxins) {
            const results = parseResearchDataFile(headers, rows);
            setParsedData(results);
            setImportStatus('reviewing');
          } else {
            // Will be handled during handleFileUpload
            setImportStatus('idle');
          }
        }
      } catch (error) {
        setFileError(error instanceof Error ? error.message : 'Failed to parse file');
      }
    }
  };

  const handleAdvancedImport = handleImportReview;

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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register New Sample</DialogTitle>
          <DialogDescription>
            Add a sample manually or import from CSV/Excel (supports both simple samples and research data with mycotoxins).
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="manual" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual" className="gap-2">
              <FileText className="h-4 w-4" />
              Manual Entry
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-2">
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

          <TabsContent value="upload" className="mt-6 space-y-4">
            {importStatus === 'idle' && (
              <>
                <label className="block">
                  <div className="rounded-lg border-2 border-dashed border-border p-8 text-center hover:border-primary/50 transition-colors cursor-pointer hover:bg-muted/30">
                    <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium text-foreground">Upload CSV or Excel file</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Simple samples: Province, District, Variety, Date<br />
                      With mycotoxins: Also include DON, AFB1, FB1, T-2, ZEA, OTA columns<br />
                      Auto-detects file type and processes accordingly
                    </p>
                    {uploadFile && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-xs font-medium text-foreground mb-1">Selected file:</p>
                        <p className="text-xs text-primary font-semibold break-all">{uploadFile.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    )}
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                </label>

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
                    <div className="overflow-x-auto p-4 max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b sticky top-0 bg-muted">
                            {filePreview[0]?.map((header, i) => (
                              <th key={i} className="px-2 py-1 text-left font-medium text-muted-foreground whitespace-nowrap">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filePreview.slice(1).map((row, rowIndex) => (
                            <tr key={rowIndex} className="border-b last:border-0 hover:bg-muted/30">
                              {row.map((cell, cellIndex) => (
                                <td key={cellIndex} className="px-2 py-1 max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
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

                {filePreview.length > 0 && (
                  <Button
                    onClick={handleFileUpload}
                    className="w-full gap-2"
                    disabled={filePreview.length < 2}
                  >
                    <Upload className="h-4 w-4" />
                    Import {Math.max(0, filePreview.length - 1)} Samples
                  </Button>
                )}
              </>
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
                      {parsedData.filter((p: any) => p.mycotoxins?.length > 0).length}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Total Results</p>
                    <p className="text-xl font-bold text-foreground">
                      {parsedData.reduce((sum: number, p: any) => sum + (p.mycotoxins?.length || 0), 0)}
                    </p>
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto space-y-2 border rounded-lg p-3">
                  {parsedData.slice(0, 20).map((item: any, idx: number) => (
                    <div key={idx} className="rounded-lg border border-border p-3 text-sm">
                      <div className="flex items-start justify-between mb-1">
                        <p className="font-medium text-foreground">
                          {item.sample?.additional_info || item.additional_info || `${item.sample?.province || item.province}, ${item.sample?.district || item.district}`}
                        </p>
                        {item.mycotoxins?.length > 0 && (
                          <Badge variant="secondary" className="text-xs">{item.mycotoxins.length} tests</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.sample?.vegetation_variety || item.vegetation_variety}
                      </p>
                      {item.mycotoxins?.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {item.mycotoxins.map((tox: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              {tox.dangerous ? (
                                <AlertTriangle className="h-3 w-3 text-red-500" />
                              ) : (
                                <Check className="h-3 w-3 text-green-500" />
                              )}
                              <span>{tox.name}: {tox.intensity}/{tox.threshold}</span>
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

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setImportStatus('idle');
                      setParsedData([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImportReview}
                    disabled={parsedData.length === 0 || isImporting}
                    className="flex-1 gap-2"
                  >
                    {isImporting && <Loader2 className="h-4 w-4 animate-spin" />}
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
                <Check className="mx-auto h-12 w-12 text-green-600 mb-3" />
                <p className="text-lg font-semibold text-green-900">Import Successful!</p>
                <p className="text-sm text-green-800 mt-2">
                  All samples have been imported and are ready for processing.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AddSampleForm;
