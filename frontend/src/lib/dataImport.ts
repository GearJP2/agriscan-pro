/**
 * Data import utilities for parsing complex research files
 * Handles mycotoxin data and auto-mapping to system fields\n */

import type { ProcessingType, Sample } from '@/types/sample';
import { MYCOTOXIN_ALIASES, getMycotoxinConfigs } from '@/constants/mycotoxins';

// Valid options for dropdowns
const PROCESSING_TYPES = ['raw', 'dried', 'milled', 'processed', 'fermented'] as const satisfies readonly ProcessingType[];

/**
 * Calculate similarity between two strings (0-1, where 1 is exact match)
 */
const calculateSimilarity = (str1: string, str2: string): number => {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  // Exact match
  if (s1 === s2) return 1;
  
  // Check if one is contained in the other (substring match)
  if (s1.includes(s2)) return 0.95;
  if (s2.includes(s1)) return 0.9;
  
  // For multi-word strings like "white rice", check if any word matches a choice
  // This handles cases like "White rice" matching "Rice"
  const s1Words = s1.split(/\s+/);
  const s2Words = s2.split(/\s+/);
  
  for (const word1 of s1Words) {
    for (const word2 of s2Words) {
      if (word1 === word2 && word1.length > 2) {
        // Exact word match, give high score
        return 0.85;
      }
    }
  }
  
  // Levenshtein distance normalized by average length (more lenient)
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = getEditDistance(longer, shorter);
  // Use average length for normalization to be more lenient
  const avgLength = (s1.length + s2.length) / 2;
  return Math.max(0, 1 - editDistance / avgLength);
};

/**
 * Calculate Levenshtein distance between two strings
 */
const getEditDistance = (s1: string, s2: string): number => {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
};

/**
 * Find best matching choice from a list of valid options
 */
const findBestMatch = <T extends string>(
  value: string,
  validChoices: readonly T[],
): T => {
  if (!validChoices.length) {
    throw new Error('validChoices must contain at least one option');
  }

  if (!value) {
    return validChoices[0];
  }
  
  let bestMatch = validChoices[0];
  let bestScore = calculateSimilarity(value, validChoices[0]);
  
  for (const choice of validChoices) {
    const score = calculateSimilarity(value, choice);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = choice;
    }
  }
  
  // Only return match if similarity is reasonable (>0.5)
  return bestScore > 0.5 ? bestMatch : validChoices[0];
};

export interface ParsedSampleWithResults {
  sample: {
    sample_id?: string;
    region: string;
    province: string;
    district: string;
    vegetation_variety: string;
    collection_date: string;
    status?: Sample['status'];
    purpose?: Sample['purpose'];
    sample_type?: Sample['sample_type'];
    processing_type?: Sample['processing_type'];
    collected_by?: string;
    additional_info?: string;
  };
  mycotoxins: Array<{
    name: string;
    intensity: number;
    threshold: number;
    unit: string;
    dangerous: boolean;
    test_method?: string;
  }>;
}

// Known mycotoxin columns and their standard thresholds
const MYCOTOXIN_CONFIGS = getMycotoxinConfigs();

// Columns to ignore (metals, minerals, isotopes, etc)
const IGNORE_CONTAINS_PATTERNS = ['metal', 'mineral', 'isotope'];

const IGNORE_EXACT_HEADERS = new Set([
  'd13c', 'd15n', 'd18o',
  'mg', 'al', 'p', 'k', 'li', 'be', 'ca', 'ti', 'v', 'cr',
  'mn', 'fe', 'co', 'ni', 'cu', 'zn', 'as', 'rb', 'sr', 'y',
  'mo', 'ag', 'cd', 'sn', 'cs', 'ba', 'la', 'ce', 'pr', 'nd',
  'sm', 'eu', 'gd', 'tl', 'pb', 'th', 'u',
]);

/**
 * Normalize a value - handle <LOD, #VALUE!, empty strings, etc
 */
export const normalizeValue = (value: string | number | null | undefined): string | number | null => {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str || str === '#VALUE!' || str === '-' || str === 'N/A' || str === 'none') {
    return null;
  }
  const lowered = str.toLowerCase();
  if (lowered === '<lod' || lowered.startsWith('<') || lowered === 'bdl' || lowered === 'nd') {
    return null; // Below/No detection
  }
  return value;
};

/**
 * Parse mycotoxin value to numeric intensity
 */
export const parseMycotoxinValue = (value: string | number | null | undefined): number | null => {
  const normalized = normalizeValue(value);
  if (normalized === null) return null;
  if (typeof normalized === 'number') return normalized;

  let cleaned = String(normalized).trim();
  // Handle locale decimal values, e.g. "0,4" -> "0.4"
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    cleaned = cleaned.replace(',', '.');
  } else if (cleaned.includes(',') && cleaned.includes('.')) {
    // Assume commas are thousands separators when both are present.
    cleaned = cleaned.replace(/,/g, '');
  }

  // Keep only first numeric segment if extra annotations exist.
  const match = cleaned.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
  if (!match) return null;

  const numericText = match[0];
  const num = parseFloat(numericText);
  return isNaN(num) ? null : num;
};

const normalizeHeader = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const getMycotoxinByAlias = (headerName: string): string | null => {
  const raw = headerName.toLowerCase().trim();
  const normalized = normalizeHeader(headerName);

  for (const [toxin, aliases] of Object.entries(MYCOTOXIN_ALIASES)) {
    if (aliases.some((alias) => {
      const aliasNormalized = normalizeHeader(alias);
      return raw.includes(alias) || normalized.includes(aliasNormalized);
    })) {
      return toxin;
    }
  }

  return null;
};

/**
 * Detect if a column is a mycotoxin column
 */
export const isMycotoxinColumn = (headerName: string): boolean => {
  return getMycotoxinByAlias(headerName) !== null;
};

export const hasAnyMycotoxinColumns = (headers: string[]): boolean => {
  const fallbackPattern = /(aflatoxin|fumonisin|deoxynivalenol|zearalenone|ochratoxin|\bafb1\b|\bafb2\b|\bafg1\b|\bafg2\b|\bafm1\b|\bfb1\b|\bdon\b|\bzea\b|\bota\b|\bt\s*-?\s*2\b|mycotoxin)/i;

  return headers.some((header) => {
    if (isMycotoxinColumn(header)) return true;
    const normalized = header.toLowerCase().replace(/[_\-]+/g, ' ').trim();
    return fallbackPattern.test(normalized);
  });
};

export const getDetectedMycotoxinHeaders = (headers: string[]): string[] => {
  const fallbackPattern = /(aflatoxin|fumonisin|deoxynivalenol|zearalenone|ochratoxin|\bafb1\b|\bafb2\b|\bafg1\b|\bafg2\b|\bafm1\b|\bfb1\b|\bdon\b|\bzea\b|\bota\b|\bt\s*-?\s*2\b|mycotoxin)/i;

  return headers.filter((header) => {
    if (isMycotoxinColumn(header)) return true;
    const normalized = header.toLowerCase().replace(/[_\-]+/g, ' ').trim();
    return fallbackPattern.test(normalized);
  });
};

/**
 * Get mycotoxin name from column header
 */
export const getMycotoxinName = (headerName: string): string | null => {
  return getMycotoxinByAlias(headerName);
};

/**
 * Check if a column should be ignored
 */
export const shouldIgnoreColumn = (headerName: string): boolean => {
  const name = headerName.toLowerCase().trim();
  const normalized = name.replace(/[^a-z0-9]/g, '');

  if (IGNORE_CONTAINS_PATTERNS.some((pattern) => name.includes(pattern))) {
    return true;
  }

  return IGNORE_EXACT_HEADERS.has(normalized);
};

/**
 * Parse a research data file with samples and mycotoxin results
 */
export const parseResearchDataFile = (headers: string[], rows: string[][]): ParsedSampleWithResults[] => {
  const results: ParsedSampleWithResults[] = [];
  const usedSampleIds = new Set<string>();
  const importStamp = Date.now().toString().slice(-6);

  const toSafeSampleId = (value: string): string => {
    return value
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^A-Za-z0-9_-]/g, '')
      .toUpperCase()
      .slice(0, 50);
  };

  const getUniqueSampleId = (rowIndex: number): string => {
    const safeBase = `IMP-${new Date().getFullYear()}-${importStamp}-${String(rowIndex + 1).padStart(4, '0')}`;

    let candidate = safeBase;
    let suffix = 1;
    while (usedSampleIds.has(candidate)) {
      const trimmedBase = safeBase.slice(0, Math.max(1, 50 - (`-${suffix}`).length));
      candidate = `${trimmedBase}-${suffix}`;
      suffix += 1;
    }

    usedSampleIds.add(candidate);
    return candidate;
  };
  
  // Find column indices
  const columnIndices: Record<string, number> = {};
  const mycotoxinIndices: Record<string, number[]> = {};
  
  headers.forEach((header, index) => {
    const lowerHeader = header.toLowerCase().trim();
    
    if (shouldIgnoreColumn(header)) {
      return; // Skip this column
    }
    
    if (isMycotoxinColumn(header)) {
      const toxinName = getMycotoxinName(header);
      if (toxinName) {
        if (!mycotoxinIndices[toxinName]) {
          mycotoxinIndices[toxinName] = [];
        }
        mycotoxinIndices[toxinName].push(index);
      }
    } else {
      // Map to sample property - use more specific patterns
      if (lowerHeader === 'region' || lowerHeader === 'regions') columnIndices['region'] = index;
      else if (lowerHeader === 'province' || lowerHeader === 'provinces') columnIndices['province'] = index;
      else if (lowerHeader === 'district' || lowerHeader === 'districts') columnIndices['district'] = index;
      else if (lowerHeader === 'variety' || lowerHeader === 'varieties' || lowerHeader === 'crop' || lowerHeader === 'crops' || lowerHeader.includes('variet')) {
        columnIndices['vegetation_variety'] = index;
      }
      else if (lowerHeader === 'processing type' || lowerHeader === 'processing_type') columnIndices['processing_type'] = index;
      else if (lowerHeader === 'sample name' || lowerHeader === 'sample_name' || lowerHeader === 'sample names') columnIndices['sample_name'] = index;
      else if (lowerHeader.includes('positive') || lowerHeader.includes('negative')) columnIndices['status'] = index;
    }
  });
  
  // Parse each row
  rows.forEach((row, rowIndex) => {
    // Skip empty rows - safely convert cells to strings first
    if (!row || row.every(cell => !cell || String(cell ?? '').trim() === '')) {
      return;
    }
    
    // Extract sample data - ensure values are strings before processing
    // Only read from columns that were actually found (index >= 0)
    const region = columnIndices['region'] >= 0 
      ? (normalizeValue(String(row[columnIndices['region']] ?? '')) ?? 'Unknown').toString()
      : 'Unknown';
    const province = columnIndices['province'] >= 0 
      ? (normalizeValue(String(row[columnIndices['province']] ?? ''))?.toString()) || ''
      : '';
    const district = columnIndices['district'] >= 0
      ? (normalizeValue(String(row[columnIndices['district']] ?? ''))?.toString()) || ''
      : '';
    const varietyRaw = columnIndices['vegetation_variety'] >= 0
      ? (normalizeValue(String(row[columnIndices['vegetation_variety']] ?? ''))?.toString()) || ''
      : '';
    // Keep variety exactly as provided in input file.
    const variety = varietyRaw;
    
    // Only set processing_type if column was explicitly found
    const processingTypeRaw = columnIndices['processing_type'] >= 0
      ? (normalizeValue(String(row[columnIndices['processing_type']] ?? ''))?.toString()) || 'raw'
      : 'raw';
    
    // Fuzzy match processing_type to closest valid option
    const finalProcessingType = processingTypeRaw ? findBestMatch(processingTypeRaw, PROCESSING_TYPES) : 'raw';
    const sampleName = columnIndices['sample_name'] >= 0
      ? (normalizeValue(String(row[columnIndices['sample_name']] ?? ''))?.toString()) || ''
      : '';
    const statusRaw = columnIndices['status'] >= 0
      ? (normalizeValue(String(row[columnIndices['status']] ?? ''))?.toString().toLowerCase()) || ''
      : '';
    const statusIsPositive = statusRaw.includes('positive');
    const statusIsNegative = statusRaw.includes('negative');
    
    // Skip if critical fields are missing
    if (!province || !district || !variety) {
      return;
    }

    const generatedSampleId = getUniqueSampleId(rowIndex);
    
    // Extract mycotoxin results
    const mycotoxins: ParsedSampleWithResults['mycotoxins'] = [];
    Object.entries(mycotoxinIndices).forEach(([toxinName, colIndexes]) => {
      let value: number | null = null;

      for (const colIndex of colIndexes) {
        const parsed = parseMycotoxinValue(String(row[colIndex] ?? ''));
        if (parsed !== null) {
          value = parsed;
          break;
        }
      }

      if (value !== null) {
        const config = MYCOTOXIN_CONFIGS[toxinName];
        mycotoxins.push({
          name: toxinName,
          intensity: value,
          threshold: config.threshold,
          unit: config.unit,
          dangerous: statusIsPositive ? true : (statusIsNegative ? false : value > config.threshold),
          test_method: 'HPLC-FLD',
        });
      }
    });

    const hasResultStatus = statusIsPositive || statusIsNegative;
    const hasAnyMycotoxinResult = mycotoxins.length > 0;
    const sampleStatus: 'pending' | 'completed' = (hasResultStatus || hasAnyMycotoxinResult) ? 'completed' : 'pending';
    
    // Create sample
    const sample: ParsedSampleWithResults['sample'] = {
      sample_id: generatedSampleId,
      region: String(region),
      province,
      district,
      vegetation_variety: variety,
      collection_date: new Date().toISOString().split('T')[0],
      status: sampleStatus,
      sample_type: 'field',
      processing_type: finalProcessingType,
      collected_by: 'Research Data Import',
      additional_info: sampleName,
    };
    
    results.push({
      sample,
      mycotoxins,
    });
  });
  
  return results;
};
