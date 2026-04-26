import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { Upload, FileText, Plus, Check, AlertCircle, AlertTriangle, Download, CalendarIcon, Loader2, Eye, EyeOff } from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { sampleAPI } from '@/lib/api';
import { getDetectedMycotoxinHeaders, hasAnyMycotoxinColumns, parseResearchDataFile } from '@/lib/dataImport';
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

type ImportStage = 'idle' | 'parsing' | 'reviewing' | 'importing' | 'success' | 'error';

interface ImportProgressState {
  processed: number;
  total: number;
  successCount: number;
  failureCount: number;
  currentSample: string;
  phaseMessage: string;
}

interface ImportEntry {
  row: number;
  parsed: any;
  sample: any;
  mycotoxins: any[];
}

interface FailedRowDetail {
  row: number;
  sample_id: string;
  region: string;
  province: string;
  district: string;
  vegetation_variety: string;
  collection_date: string;
  error: string;
}

const generateImportSampleId = (rowNumber: number) => {
  const year = new Date().getFullYear();
  const stamp = Date.now().toString().slice(-6);
  return `SAM-${year}-${stamp}-${rowNumber.toString().padStart(4, '0')}`;
};

const generateLogId = () => {
  return `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
};

// Clean text by removing surrounding quotes
const cleanText = (text: string): string => {
  if (!text) return '';
  return text.trim().replace(/^["']|["']$/g, '').trim();
};

const isLikelyDateValue = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;

  // YYYY-MM-DD or YYYY/MM/DD
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(normalized)) return true;
  // DD/MM/YYYY or MM/DD/YYYY
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(normalized)) return true;
  // 21-Dec, 21 Dec, Dec-21, Dec 21
  if (/^\d{1,2}[\s-][a-z]{3,9}$/.test(normalized)) return true;
  if (/^[a-z]{3,9}[\s-]\d{1,2}$/.test(normalized)) return true;

  return false;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const formatErrorPayload = (value: unknown): string => {
  if (value === null || value === undefined) return '';

  if (Array.isArray(value)) {
    return value
      .map((item) => formatErrorPayload(item))
      .filter(Boolean)
      .join(', ');
  }

  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nestedValue]) => {
        const formatted = formatErrorPayload(nestedValue);
        return formatted ? `${key}: ${formatted}` : key;
      })
      .filter(Boolean)
      .join('; ');
  }

  return String(value);
};

const getRetryDelayMs = (err: any, attempt: number) => {
  const retryAfterHeader = err?.response?.headers?.['retry-after'];
  const retryAfterSeconds = Number.parseInt(String(retryAfterHeader ?? ''), 10);

  if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }

  return Math.min(1000 * 2 ** attempt, 8000);
};

const getReadableImportError = (err: any): string => {
  if (err?.response?.status === 429) {
    const retryAfterHeader = err?.response?.headers?.['retry-after'];
    const retryAfterSeconds = Number.parseInt(String(retryAfterHeader ?? ''), 10);

    if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
      return `Rate limit exceeded. The server asked to wait ${retryAfterSeconds} second${retryAfterSeconds === 1 ? '' : 's'} before retrying.`;
    }

    return 'Rate limit exceeded. Too many import requests were sent to the server too quickly.';
  }

  const responseData = err?.response?.data;
  if (responseData) {
    const formatted = formatErrorPayload(responseData);
    if (formatted) {
      return formatted;
    }
  }

  if (err?.message) {
    return err.message;
  }

  return 'Failed to create sample';
};

const normalizeSampleId = (rawValue: string, rowNumber: number): string => {
  const cleaned = String(rawValue || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9_-]/g, '');

  if (!cleaned) return generateImportSampleId(rowNumber);
  if (cleaned.length > 48) return cleaned.slice(0, 48);
  return cleaned;
};

const normalizePurpose = (rawValue: string): any => {
  const value = String(rawValue || '').trim().toLowerCase();
  if (!value) return 'routine';
  if (value === 'routine') return 'routine';
  if (value === 'complaint driven' || value.includes('complaint')) return 'complaint driven';
  if (value === 'target surveillance' || value.includes('target')) return 'target surveillance';
  return 'routine';
};

const normalizeSampleType = (rawValue: string): any => {
  const value = String(rawValue || '').trim().toLowerCase();
  if (value.includes('field')) return 'field';
  if (value.includes('market')) return 'market';
  if (value.includes('storage')) return 'storage';
  if (value.includes('export')) return 'export';
  return 'field';
};

const normalizeProcessingType = (rawValue: string): any => {
  const value = String(rawValue || '').trim().toLowerCase();
  if (value.includes('raw')) return 'raw';
  if (value.includes('dried') || value.includes('dry')) return 'dried';
  if (value.includes('milled') || value.includes('mill')) return 'milled';
  if (value.includes('processed') || value.includes('process')) return 'processed';
  if (value.includes('fermented') || value.includes('ferment')) return 'fermented';
  return 'raw';
};

const toBulkCreatePayload = (sample: any): Partial<Sample> => ({
  sample_id: sample.sample_id,
  region: sample.region || 'Unknown',
  province: sample.province,
  district: sample.district,
  vegetation_variety: sample.vegetation_variety,
  collection_date: sample.collection_date,
  status: sample.status || 'pending',
  purpose: sample.purpose || null,
  sample_type: sample.sample_type || null,
  processing_type: sample.processing_type || null,
  collected_by: sample.collected_by || null,
  additional_info: sample.additional_info || '',
});

const groupImportErrors = (errors: string[]) => {
  const groups: Record<string, number> = {};

  errors.forEach((error) => {
    const withoutRow = error.replace(/^Row\s+\d+\s*:\s*/i, '').trim();
    let key = withoutRow;

    if (/rate limit|too many requests|429/i.test(withoutRow)) {
      key = 'Rate limit (429)';
    } else if (/already exists|unique|duplicate/i.test(withoutRow)) {
      key = 'Duplicate sample ID';
    } else if (/missing required|required/i.test(withoutRow)) {
      key = 'Missing required fields';
    } else if (/validation/i.test(withoutRow)) {
      key = 'Validation error';
    }

    groups[key] = (groups[key] || 0) + 1;
  });

  return Object.entries(groups)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
};

const AddSampleForm = ({ onAddSample, onAddMultipleSamples }: AddSampleFormProps) => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
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
  const [importStatus, setImportStatus] = useState<ImportStage>('idle');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [failedRows, setFailedRows] = useState<FailedRowDetail[]>([]);
  const [importProgress, setImportProgress] = useState<ImportProgressState>({
    processed: 0,
    total: 0,
    successCount: 0,
    failureCount: 0,
    currentSample: '',
    phaseMessage: '',
  });

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
  const importProgressValue = importProgress.total > 0
    ? Math.round((importProgress.processed / importProgress.total) * 100)
    : importStatus === 'parsing'
      ? 20
      : 0;
  const groupedImportErrors = groupImportErrors(importErrors);

  const resetImportFeedback = () => {
    setImportErrors([]);
    setFailedRows([]);
    setImportProgress({
      processed: 0,
      total: 0,
      successCount: 0,
      failureCount: 0,
      currentSample: '',
      phaseMessage: '',
    });
  };

  const downloadFailedRowsReport = () => {
    if (failedRows.length === 0) return;

    const headers = ['row', 'sample_id', 'region', 'province', 'district', 'vegetation_variety', 'collection_date', 'error'];
    const lines = [
      headers.join(','),
      ...failedRows.map((row) => headers.map((key) => `"${String((row as any)[key] ?? '').replace(/"/g, '""')}"`).join(',')),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `failed_samples_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
      sample_id: '',
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
        reader.onload = async (event) => {
          try {
            const buffer = event.target?.result as ArrayBuffer;
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);
            const worksheet = workbook.worksheets[0];
            const jsonData: string[][] = [];
            
            worksheet.eachRow((row: ExcelJS.Row) => {
              const rowData: string[] = [];
              if (Array.isArray(row.values)) {
                // exceljs row.values is 1-indexed (index 0 is undefined)
                for (let i = 1; i < row.values.length; i++) {
                  rowData.push(String(row.values[i] ?? ''));
                }
              }
              jsonData.push(rowData);
            });

            // Clean quotes from all cells
            const cleanedData = jsonData.map((row: string[]) =>
              row.map((cell: string) => cleanText(String(cell ?? '')))
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
          try {
            const text = event.target?.result as string;
            Papa.parse<string[]>(text, {
              skipEmptyLines: true,
              complete: (results: Papa.ParseResult<string[]>) => {
                const cleanedData = results.data.map((rowValue: string[]) =>
                  rowValue.map((cellValue: string) => cleanText(String(cellValue ?? '')))
                );
                resolve(cleanedData);
              },
              error: (error: Error) => {
                reject(new Error(`Failed to parse CSV: ${error.message || 'Unknown error'}`));
              }
            });
          } catch (error) {
            reject(new Error('Failed to parse CSV file'));
          }
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
    resetImportFeedback();

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
        setImportStatus('parsing');
        setImportProgress({
          processed: 0,
          total: 1,
          successCount: 0,
          failureCount: 0,
          currentSample: file.name,
          phaseMessage: 'Reading and validating the uploaded file.',
        });
        console.log(`[FileUpload] Parsing file...`);
        const parsed = await parseFileData(file);
        console.log(`[FileUpload] File parsed successfully: ${parsed.length} rows, ${parsed[0]?.length || 0} columns`);
        setFilePreview(parsed.slice(0, 6));
        resetImportFeedback();
        setImportStatus('idle');
      } catch (error) {
        console.error('[FileUpload] Parse error:', error);
        setFileError(error instanceof Error ? error.message : 'Failed to parse file');
        setImportStatus('error');
        setImportErrors([error instanceof Error ? error.message : 'Failed to parse file']);
        setImportProgress({
          processed: 0,
          total: 1,
          successCount: 0,
          failureCount: 1,
          currentSample: file.name,
          phaseMessage: 'The file could not be parsed.',
        });
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
    setImportStatus('parsing');
    setImportErrors([]);
    setImportProgress({
      processed: 0,
      total: 1,
      successCount: 0,
      failureCount: 0,
      currentSample: uploadFile.name,
      phaseMessage: 'Preparing your file for import preview.',
    });

    try {
      const allParsed = await parseFileData(uploadFile);
      const headers = allParsed[0].map(h => String(h ?? '').trim());
      const rows = allParsed.slice(1);

      console.log('[FileUpload] File headers:', headers);

      let parsedData: any[] = [];

      // Always try research parser first to avoid missing toxin data due header variations.
      // Some files have title rows and 2-level headers, so scan the first rows dynamically.
      const maxHeaderProbe = Math.min(3, Math.max(1, allParsed.length - 1));
      const researchCandidates: Array<{ name: string; headers: string[]; rows: any[] }> = [];

      const isLikelyHeaderRow = (row: any[]) => {
        const values = (row || []).map((cell) => String(cell ?? '').trim()).filter(Boolean);
        if (values.length === 0) return false;

        const headerLikeCount = values.filter((value) => {
          const lower = value.toLowerCase();
          if (lower === '<lod' || lower.startsWith('<lod')) return false;
          if (/^tint\d+/i.test(value)) return false;
          if (/^[-+]?\d+(?:[.,]\d+)?$/.test(value)) return false;
          return /[a-z]/i.test(value);
        }).length;

        return headerLikeCount >= Math.max(2, Math.ceil(values.length * 0.4));
      };

      const forwardFill = (values: string[]) => {
        let lastValue = '';
        return values.map((value) => {
          const trimmed = String(value ?? '').trim();
          if (trimmed) {
            lastValue = trimmed;
            return trimmed;
          }
          return lastValue;
        });
      };

      const buildHybridHeaders = (topRow: string[], secondRow: string[]) => {
        const propagatedTopRow = forwardFill(topRow);

        return propagatedTopRow.map((top, idx) => {
          const second = String(secondRow[idx] ?? '').trim();
          const normalizedTop = top.toLowerCase();
          const topLooksLikeMycotoxinGroup = normalizedTop.includes('mycotoxin');
          const secondLooksLikeMycotoxin = !!second && hasAnyMycotoxinColumns([second]);

          if (topLooksLikeMycotoxinGroup && second) {
            return `${top} ${second}`.trim();
          }

          if (secondLooksLikeMycotoxin) {
            return second;
          }

          if (top && !topLooksLikeMycotoxinGroup) {
            return top;
          }

          return (second || top || '').trim();
        });
      };

      for (let i = 0; i < maxHeaderProbe; i++) {
        const primary = (allParsed[i] || []).map((h: any) => String(h ?? '').trim());
        if (primary.length && isLikelyHeaderRow(primary)) {
          researchCandidates.push({
            name: `header-row-${i + 1}`,
            headers: primary,
            rows: allParsed.slice(i + 1),
          });
        }

        if (i + 1 < allParsed.length) {
          const secondary = (allParsed[i + 1] || []).map((h: any) => String(h ?? '').trim());
          const combined = primary.map((top, idx) => {
            const second = String(secondary[idx] ?? '').trim();
            if (top && second) return `${top} ${second}`.trim();
            return (second || top || '').trim();
          });
          const hybrid = buildHybridHeaders(primary, secondary);
          if (combined.length && isLikelyHeaderRow(combined)) {
            researchCandidates.push({
              name: `combined-header-rows-${i + 1}-${i + 2}`,
              headers: combined,
              rows: allParsed.slice(i + 2),
            });
          }
          if (hybrid.length && isLikelyHeaderRow(hybrid)) {
            researchCandidates.push({
              name: `hybrid-header-rows-${i + 1}-${i + 2}`,
              headers: hybrid,
              rows: allParsed.slice(i + 2),
            });
          }
        }
      }

      const directResearchResult = parseResearchDataFile(headers, rows as any);
      const directMycotoxinCount = directResearchResult.reduce((sum, entry) => sum + (entry.mycotoxins?.length || 0), 0);
      const directSampleCount = directResearchResult.length;
      const directHasMycotoxinHeaders = hasAnyMycotoxinColumns(headers);

      let bestResearchResult: any[] = directResearchResult;
      let bestMycotoxinCount = directMycotoxinCount;
      let bestSampleCount = directSampleCount;
      let chosenCandidateName = 'direct-header-row-1';

      for (const candidate of researchCandidates) {
        const result = parseResearchDataFile(candidate.headers, candidate.rows as any);
        const mycotoxinCount = result.reduce((sum, entry) => sum + (entry.mycotoxins?.length || 0), 0);
        const sampleCount = result.length;

        if (
          mycotoxinCount > bestMycotoxinCount ||
          (mycotoxinCount === bestMycotoxinCount && sampleCount > bestSampleCount)
        ) {
          bestMycotoxinCount = mycotoxinCount;
          bestSampleCount = sampleCount;
          bestResearchResult = result;
          chosenCandidateName = candidate.name;
        }
      }

      const detectedMycotoxinHeaders = Array.from(
        new Set(
          researchCandidates.flatMap((candidate) => getDetectedMycotoxinHeaders(candidate.headers))
        )
      ).filter((h) => /[a-zA-Z]/.test(h));

      const hasMycotoxinHeaders =
        directHasMycotoxinHeaders ||
        researchCandidates.some((candidate) => hasAnyMycotoxinColumns(candidate.headers));

      if (hasMycotoxinHeaders) {
        if (bestSampleCount === 0) {
          throw new Error('Detected mycotoxin columns but could not parse any valid sample rows. Please verify province, district, and variety columns.');
        }
        console.log('[FileUpload] Parsed mycotoxin results, using research parser', {
          candidate: chosenCandidateName,
          samples: bestResearchResult.length,
          parsedMycotoxinCount: bestMycotoxinCount,
          detectedMycotoxinHeaders,
        });
        parsedData = bestResearchResult;
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
        const normalizeHeader = (value: string) =>
          value.toLowerCase().trim().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ');

        const findColumnIndex = (searchTerms: string[]): number => {
          const normalizedTerms = searchTerms.map((term) => normalizeHeader(term));
          const normalizedHeaders = headers.map((h) => normalizeHeader(h));

          // Prefer exact header matches first.
          const exactIdx = normalizedHeaders.findIndex((header) => normalizedTerms.includes(header));
          if (exactIdx !== -1) return exactIdx;

          // Then prefer header contains term (NOT reverse) to avoid short-header false positives like "AF".
          for (const term of normalizedTerms) {
            if (term.length < 3) continue;
            const containsIdx = normalizedHeaders.findIndex((header) => header.includes(term));
            if (containsIdx !== -1) return containsIdx;
          }

          // Last attempt: all words from term exist in header.
          for (const term of normalizedTerms) {
            const words = term.split(' ').filter((w) => w.length >= 3);
            if (!words.length) continue;
            const idx = normalizedHeaders.findIndex((header) => words.every((w) => header.includes(w)));
            if (idx !== -1) return idx;
          }

          return -1;
        };

        const provinceIndex = findColumnIndex(['province', 'provinces']);
        const districtIndex = findColumnIndex(['district', 'districts']);
        const varietyIndex = findColumnIndex(['vegetation_variety', 'variety', 'varieties', 'crop variety', 'crop_variety']);
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
          const errorMessage = 'Missing required column: Province (searched for: province, provinces)';
          setFileError(errorMessage); 
          setIsImporting(false); 
          setImportStatus('error'); 
          setImportErrors([errorMessage]);
          setImportProgress({
            processed: 0,
            total: 1,
            successCount: 0,
            failureCount: 1,
            currentSample: uploadFile.name,
            phaseMessage: 'The file is missing a required province column.',
          });
          console.error('[FileUpload] Available headers:', headers);
          return; 
        }
        if (districtIndex === -1) { 
          const errorMessage = 'Missing required column: District (searched for: district, districts)';
          setFileError(errorMessage); 
          setIsImporting(false); 
          setImportStatus('error'); 
          setImportErrors([errorMessage]);
          setImportProgress({
            processed: 0,
            total: 1,
            successCount: 0,
            failureCount: 1,
            currentSample: uploadFile.name,
            phaseMessage: 'The file is missing a required district column.',
          });
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
        const usedSampleIds = new Set<string>();

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

          // Validate and clean variety - reject numeric/year and date-like values.
          if (variety && (/^\d+$/.test(variety) || isLikelyDateValue(variety))) {
            console.warn(`[FileUpload] Row ${i + 1}: variety looks invalid (${variety}), treating as invalid`);
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

          let sampleId = generateImportSampleId(i + 1);
          if (usedSampleIds.has(sampleId)) {
            sampleId = `${sampleId}-${(i + 1).toString().padStart(3, '0')}`;
          }
          usedSampleIds.add(sampleId);
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
          const purposeRaw = columnIndexes['purpose'] >= 0 ? getRowValue_Current(columnIndexes['purpose']) : '';

          const sample: Sample = {
            sample_id: sampleId,
            region,
            province,
            district,
            vegetation_variety: variety || 'Unknown',
            collection_date: formattedDate,
            status: 'pending',
            purpose: normalizePurpose(purposeRaw),
            sample_type: normalizeSampleType(sampleTypeRaw),
            processing_type: normalizeProcessingType(processingTypeRaw),
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
        console.log(`  Sample ${idx + 1}: ${JSON.stringify({
          sample_id: sample.sample_id,
          region: sample.region,
          province: sample.province,
          district: sample.district,
          vegetation_variety: sample.vegetation_variety,
          collection_date: sample.collection_date,
        })}`);
      });
      
      setParsedData(parsedData);
      setImportStatus('reviewing');
      resetImportFeedback();
      setIsImporting(false); // Reset importing state after parsing completes
    } catch (error) {
      console.error('[FileUpload] File import error:', error);
      setFileError(error instanceof Error ? error.message : 'Failed to import file');
      setImportStatus('error');
      setImportErrors([error instanceof Error ? error.message : 'Failed to import file']);
      setImportProgress({
        processed: 0,
        total: 1,
        successCount: 0,
        failureCount: 1,
        currentSample: uploadFile.name,
        phaseMessage: 'The file could not be prepared for import.',
      });
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
      setImportStatus('error');
      setImportErrors(validationErrors);
      setImportProgress({
        processed: 0,
        total: parsedData.length,
        successCount: 0,
        failureCount: invalidCount,
        currentSample: '',
        phaseMessage: 'Validation failed before any samples were sent to the server.',
      });
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
        setImportErrors([]);
        setFailedRows([]);
        setImportProgress({
          processed: 0,
          total: parsedData.length,
          successCount: 0,
          failureCount: 0,
          currentSample: '',
          phaseMessage: 'Uploading samples to the server and attaching test results.',
        });

    try {
      let successCount = 0;
      const errors: string[] = [];
      const failureDetails: FailedRowDetail[] = [];
      const indexedEntries: ImportEntry[] = parsedData.map((parsed: any, idx: number) => {
        const sample = parsed.sample || parsed;
        return {
          row: idx + 1,
          parsed,
          sample,
          mycotoxins: parsed.mycotoxins || [],
        };
      });

      const simpleEntries = indexedEntries.filter((entry) => entry.mycotoxins.length === 0);
      const toxinEntries = indexedEntries.filter((entry) => entry.mycotoxins.length > 0);

      const recordFailure = (entry: ImportEntry, errorMsg: string) => {
        errors.push(`Row ${entry.row}: ${errorMsg}`);
        failureDetails.push({
          row: entry.row,
          sample_id: entry.sample.sample_id,
          region: entry.sample.region,
          province: entry.sample.province,
          district: entry.sample.district,
          vegetation_variety: entry.sample.vegetation_variety,
          collection_date: entry.sample.collection_date,
          error: errorMsg,
        });
      };

      const createSampleWithRetry = async (sample: any, rowNumber: number) => {
        let requestSample = sample;
        let didRetryDuplicateId = false;

        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            return await sampleAPI.createSample(requestSample);
          } catch (err: any) {
            const sampleIdError = err?.response?.data?.sample_id;
            const sampleIdErrorText = Array.isArray(sampleIdError)
              ? sampleIdError.join(' ').toLowerCase()
              : String(sampleIdError || '').toLowerCase();
            const fullErrorText = formatErrorPayload(err?.response?.data).toLowerCase();

            const isDuplicateSampleId =
              sampleIdErrorText.includes('already exists') ||
              sampleIdErrorText.includes('unique') ||
              /sample[_\s-]*id.*already exists|duplicate|unique constraint/.test(fullErrorText);
            if (isDuplicateSampleId && !didRetryDuplicateId) {
              const baseId = String(requestSample.sample_id || `IMP-${new Date().getFullYear()}`)
                .replace(/\s+/g, '-')
                .replace(/[^A-Za-z0-9_-]/g, '')
                .toUpperCase()
                .slice(0, 40);
              const retrySuffix = `${Date.now().toString().slice(-4)}${rowNumber}`;
              const retrySampleId = `${baseId}-${retrySuffix}`.slice(0, 50);

              requestSample = { ...requestSample, sample_id: retrySampleId };
              didRetryDuplicateId = true;
              continue;
            }

            if (err?.response?.status === 429 && attempt < 4) {
              const delayMs = getRetryDelayMs(err, attempt);
              setImportProgress((prev) => ({
                ...prev,
                currentSample: requestSample.sample_id || `Row ${rowNumber}`,
                phaseMessage: `Rate limit reached. Retrying row ${rowNumber} in ${Math.ceil(delayMs / 1000)}s.`,
              }));
              await wait(delayMs);
              continue;
            }

            throw err;
          }
        }

        throw new Error(`Failed to create sample after multiple attempts for row ${rowNumber}.`);
      };

      const bulkCreateChunkWithRetry = async (entries: ImportEntry[]) => {
        const payload = entries.map((entry) => toBulkCreatePayload(entry.sample));

        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            await sampleAPI.bulkCreateSamples(payload);
            return;
          } catch (err: any) {
            if (err?.response?.status === 429 && attempt < 3) {
              const delayMs = getRetryDelayMs(err, attempt);
              setImportProgress((prev) => ({
                ...prev,
                currentSample: `${entries[0]?.sample?.sample_id || 'batch'} -> ${entries[entries.length - 1]?.sample?.sample_id || 'batch'}`,
                phaseMessage: `Rate limit reached for batch import. Retrying in ${Math.ceil(delayMs / 1000)}s.`,
              }));
              await wait(delayMs);
              continue;
            }

            throw err;
          }
        }
      };

      // 1) Fast path: chunked bulk import for simple rows (no mycotoxins)
      const SIMPLE_CHUNK_SIZE = 20;
      for (let start = 0; start < simpleEntries.length; start += SIMPLE_CHUNK_SIZE) {
        const chunk = simpleEntries.slice(start, start + SIMPLE_CHUNK_SIZE);
        const chunkLabel = `${start + 1}-${Math.min(start + chunk.length, simpleEntries.length)} of ${simpleEntries.length}`;

        setImportProgress((prev) => ({
          ...prev,
          currentSample: `Simple batch ${chunkLabel}`,
          phaseMessage: `Bulk importing simple samples (${chunkLabel}).`,
        }));

        try {
          await bulkCreateChunkWithRetry(chunk);
          successCount += chunk.length;
          setImportProgress((prev) => ({
            ...prev,
            processed: prev.processed + chunk.length,
            successCount,
            failureCount: errors.length,
          }));
        } catch (chunkError: any) {
          // Fallback: salvage each row in this chunk individually for granular errors.
          for (const entry of chunk) {
            try {
              setImportProgress((prev) => ({
                ...prev,
                currentSample: entry.sample.sample_id || `Row ${entry.row}`,
                phaseMessage: `Retrying row ${entry.row} individually after batch failure.`,
              }));
              await createSampleWithRetry(entry.sample, entry.row);
              successCount++;
            } catch (err: any) {
              const errorMsg = getReadableImportError(err);
              recordFailure(entry, errorMsg);
            } finally {
              setImportProgress((prev) => ({
                ...prev,
                processed: prev.processed + 1,
                successCount,
                failureCount: errors.length,
              }));
            }
          }
        }
      }

      // 2) Process rows with mycotoxin results individually (must keep sample IDs for child records)
      for (const entry of toxinEntries) {
        try {
          setImportProgress((prev) => ({
            ...prev,
            currentSample: entry.sample.sample_id || `Row ${entry.row}`,
            phaseMessage: `Processing sample ${entry.row} with ${entry.mycotoxins.length} mycotoxin results.`,
          }));

          const sampleResponse = await createSampleWithRetry(entry.sample, entry.row);
          const sampleId = sampleResponse.sample_id;

          for (const mycotoxin of entry.mycotoxins) {
            await sampleAPI.addMycotoxinResult(sampleId, mycotoxin);
          }

          successCount++;
        } catch (err: any) {
          const errorMsg = getReadableImportError(err);
          recordFailure(entry, errorMsg);
        } finally {
          setImportProgress((prev) => ({
            ...prev,
            processed: prev.processed + 1,
            successCount,
            failureCount: errors.length,
          }));
        }
      }

      console.log(`[Import] Loop complete. Successful: ${successCount}/${parsedData.length}`);
      
      // Show failures for debugging
      if (failureDetails.length > 0) {
        console.log(`[Import] Failure details (${failureDetails.length}):`, failureDetails.slice(0, 10));
      }

      // Always reset importing state
      setIsImporting(false);
      setFailedRows(failureDetails);

      if (successCount > 0) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['samples-list'] }),
          queryClient.invalidateQueries({ queryKey: ['samples-dashboard'] }),
        ]);
      }

      if (successCount > 0) {
        const totalToxins = parsedData.reduce((sum: number, p: any) => sum + (p.mycotoxins?.length || 0), 0);
        if (errors.length === 0) {
          setImportStatus('success');
          setImportProgress({
            processed: parsedData.length,
            total: parsedData.length,
            successCount,
            failureCount: 0,
            currentSample: '',
            phaseMessage: 'All samples finished importing successfully.',
          });

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
            resetImportFeedback();
            form.reset();
          }, 2000);
        } else {
          setImportStatus('error');
          setImportErrors(errors);
          setImportProgress({
            processed: parsedData.length,
            total: parsedData.length,
            successCount,
            failureCount: errors.length,
            currentSample: '',
            phaseMessage: `${successCount} samples imported, but some rows still need attention.`,
          });

          toast({
            title: 'Import Partially Complete',
            description: `${successCount} samples imported, ${errors.length} failed. Review the error panel for details.`,
            variant: 'destructive',
          });
        }
      } else {
        // All samples failed
        setImportStatus('error');
        setImportErrors(errors);
        setImportProgress({
          processed: parsedData.length,
          total: parsedData.length,
          successCount: 0,
          failureCount: errors.length,
          currentSample: '',
          phaseMessage: 'No samples were imported. Review the reported errors and try again.',
        });
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
      setImportStatus('error');
      setImportErrors([error?.message || 'An unexpected error occurred']);
      setImportProgress((prev) => ({
        ...prev,
        failureCount: prev.failureCount + 1,
        phaseMessage: 'The import was interrupted before completion.',
      }));
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
        reader.onload = async (event) => {
          try {
            const buffer = event.target?.result as ArrayBuffer;
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);
            const worksheet = workbook.worksheets[0];
            const jsonData: string[][] = [];
            
            worksheet.eachRow((row) => {
              const rowData: string[] = [];
              if (Array.isArray(row.values)) {
                for (let i = 1; i < row.values.length; i++) {
                  rowData.push(String(row.values[i] ?? ''));
                }
              }
              jsonData.push(rowData);
            });

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
          try {
            const text = event.target?.result as string;
            Papa.parse<string[]>(text, {
              skipEmptyLines: true,
              complete: (results: Papa.ParseResult<string[]>) => {
                const cleanedData = results.data.map((rowValue: string[]) =>
                  rowValue.map((cellValue: string) => cleanText(String(cellValue ?? '')))
                );
                resolve(cleanedData);
              },
              error: (error: Error) => {
                reject(new Error(`Failed to parse CSV: ${error.message || 'Unknown error'}`));
              }
            });
          } catch (error) {
            reject(new Error('Failed to parse CSV file'));
          }
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
      if (!newOpen) {
        resetImportFeedback();
        setImportStatus('idle');
        setFileError(null);
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
            {(importStatus === 'parsing' || importStatus === 'importing') && (
              <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/10 p-6 shadow-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 ring-8 ring-primary/5">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>

                <div className="mt-5 text-center">
                  <p className="text-lg font-semibold text-foreground">
                    {importStatus === 'parsing' ? 'Preparing import preview' : 'Importing samples'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{importProgress.phaseMessage}</p>
                </div>

                <div className="mt-6 space-y-3">
                  <Progress value={importProgressValue} className="h-2.5" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {importProgress.total > 0
                        ? `${importProgress.processed} / ${importProgress.total} completed`
                        : 'Initializing import'}
                    </span>
                    <span>{importProgressValue}%</span>
                  </div>

                  {importProgress.currentSample && (
                    <div className="rounded-xl border border-border/60 bg-background/80 px-4 py-3 text-sm">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Current item</p>
                      <p className="mt-1 truncate font-medium text-foreground">{importProgress.currentSample}</p>
                    </div>
                  )}

                  {importStatus === 'importing' && (
                    <div className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-4">
                      <div className="rounded-xl border border-border/60 bg-background/70 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Queued</p>
                        <p className="mt-1 text-lg font-semibold text-foreground">{Math.max(importProgress.total - importProgress.processed, 0)}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-background/70 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Imported</p>
                        <p className="mt-1 text-lg font-semibold text-emerald-600">{importProgress.successCount}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-background/70 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Errors</p>
                        <p className="mt-1 text-lg font-semibold text-destructive">{importProgress.failureCount}</p>
                      </div>
                      <div className="flex items-center justify-center gap-1 rounded-xl border border-border/60 bg-background/70 p-3">
                        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-primary" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

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

            {importStatus === 'error' && (
              <div className="space-y-4 rounded-2xl border border-destructive/25 bg-destructive/5 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-destructive/10 p-2">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground">Import needs attention</p>
                    <p className="mt-1 text-sm text-muted-foreground">{importProgress.phaseMessage || 'Some parts of the import failed. Review the details below before retrying.'}</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                    <p className="text-xs text-muted-foreground">Processed</p>
                    <p className="mt-1 text-xl font-semibold text-foreground">{importProgress.processed}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                    <p className="text-xs text-muted-foreground">Imported</p>
                    <p className="mt-1 text-xl font-semibold text-emerald-600">{importProgress.successCount}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                    <p className="text-xs text-muted-foreground">Failed</p>
                    <p className="mt-1 text-xl font-semibold text-destructive">{Math.max(importProgress.failureCount, importErrors.length)}</p>
                  </div>
                </div>

                {importErrors.length > 0 && (
                  <div className="rounded-xl border border-destructive/20 bg-background/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Error details</p>
                    {groupedImportErrors.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {groupedImportErrors.slice(0, 5).map((group) => (
                          <Badge key={group.reason} variant="outline" className="text-xs">
                            {group.reason}: {group.count}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
                      {importErrors.slice(0, 8).map((error, index) => (
                        <div key={`${error}-${index}`} className="rounded-lg border border-destructive/10 bg-destructive/5 px-3 py-2 text-sm text-foreground">
                          {error}
                        </div>
                      ))}
                    </div>
                    {importErrors.length > 8 && (
                      <p className="mt-3 text-xs text-muted-foreground">Showing 8 of {importErrors.length} errors.</p>
                    )}
                    {failedRows.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3 gap-2"
                        onClick={downloadFailedRowsReport}
                      >
                        <Download className="h-4 w-4" />
                        Download Failed Rows ({failedRows.length})
                      </Button>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (parsedData.length > 0) {
                        setImportStatus('reviewing');
                      } else {
                        setImportStatus('idle');
                      }
                      setFileError(null);
                      resetImportFeedback();
                    }}
                  >
                    {parsedData.length > 0 ? 'Back to Review' : 'Choose Another File'}
                  </Button>
                  {parsedData.length > 0 && (
                    <Button onClick={handleImportReview} className="gap-2">
                      <Upload className="h-4 w-4" />
                      Retry Import
                    </Button>
                  )}
                </div>
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
