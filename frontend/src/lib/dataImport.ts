/**
 * Data import utilities for parsing complex research files
 * Handles mycotoxin data and auto-mapping to system fields\n */

// Valid options for dropdowns
const VEGETATION_TYPES = [
  'Rice', 'White rice', 'Brown rice', 'Jasmine rice',
  'Corn', 'Sweet corn', 'Popcorn',
  'Wheat', 'Durum wheat',
  'Cassava', 'Peanut', 'Soybean',
  'Other'
];
const PROCESSING_TYPES = ['raw', 'dried', 'milled', 'processed', 'fermented'];

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
const findBestMatch = (value: string, validChoices: string[]): string => {
  if (!value || !validChoices.length) return validChoices[0] || '';
  
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
    purpose?: string;
    sample_type: string;
    processing_type: string;
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
const MYCOTOXIN_CONFIGS: Record<string, { threshold: number; unit: string }> = {
  'DON': { threshold: 1000, unit: 'ppb' },           // Deoxynivalenol
  'AFB1': { threshold: 5, unit: 'ppb' },             // Aflatoxin B1
  'FB1': { threshold: 2000, unit: 'ppb' },           // Fumonisin B1
  'T-2': { threshold: 100, unit: 'ppb' },            // T-2 Toxin
  'ZEA': { threshold: 200, unit: 'ppb' },            // Zearalenone
  'OTA': { threshold: 5, unit: 'ppb' },              // Ochratoxin A
  'AF': { threshold: 5, unit: 'ppb' },               // Aflatoxin
  'AFG1': { threshold: 5, unit: 'ppb' },             // Aflatoxin G1
  'AFG2': { threshold: 5, unit: 'ppb' },             // Aflatoxin G2
  'AFM1': { threshold: 0.5, unit: 'ppb' },           // Aflatoxin M1
};

// Columns to ignore (metals, minerals, isotopes, etc)
const IGNORE_PATTERNS = [
  'metal', 'mineral', 'isotope', 'd13c', 'd15n', 'd18o',
  'mg', 'al', 'p', 'k', 'li', 'be', 'ca', 'ti', 'v', 'cr',
  'mn', 'fe', 'co', 'ni', 'cu', 'zn', 'as', 'rb', 'sr', 'y',
  'mo', 'ag', 'cd', 'sn', 'cs', 'ba', 'la', 'ce', 'pr', 'nd',
  'sm', 'eu', 'gd', 'tl', 'pb', 'th', 'u', 'positive/negative'
];

/**
 * Normalize a value - handle <LOD, #VALUE!, empty strings, etc
 */
export const normalizeValue = (value: string | number): string | number | null => {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str || str === '#VALUE!' || str === '-' || str === 'N/A' || str === 'none') {
    return null;
  }
  if (str.toLowerCase() === '<lod') return null; // Below limit of detection
  return value;
};

/**
 * Parse mycotoxin value to numeric intensity
 */
export const parseMycotoxinValue = (value: any): number | null => {
  const normalized = normalizeValue(value);
  if (normalized === null) return null;
  if (typeof normalized === 'number') return normalized;
  
  const num = parseFloat(String(normalized));
  return isNaN(num) ? null : num;
};

/**
 * Detect if a column is a mycotoxin column
 */
export const isMycotoxinColumn = (headerName: string): boolean => {
  const name = headerName.toUpperCase().trim();
  return Object.keys(MYCOTOXIN_CONFIGS).some(toxin => name.includes(toxin));
};

/**
 * Get mycotoxin name from column header
 */
export const getMycotoxinName = (headerName: string): string | null => {
  const name = headerName.toUpperCase().trim();
  for (const toxin of Object.keys(MYCOTOXIN_CONFIGS)) {
    if (name.includes(toxin)) {
      return toxin;
    }
  }
  return null;
};

/**
 * Check if a column should be ignored
 */
export const shouldIgnoreColumn = (headerName: string): boolean => {
  const name = headerName.toLowerCase().trim();
  return IGNORE_PATTERNS.some(pattern => name.includes(pattern));
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

  const getUniqueSampleId = (baseId: string, rowIndex: number): string => {
    const fallbackBase = `IMP-${new Date().getFullYear()}-${importStamp}-${String(rowIndex + 1).padStart(4, '0')}`;
    const safeBase = toSafeSampleId(baseId) || fallbackBase;

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
  const mycotoxinIndices: Record<string, number> = {};
  
  headers.forEach((header, index) => {
    const lowerHeader = header.toLowerCase().trim();
    
    if (shouldIgnoreColumn(header)) {
      return; // Skip this column
    }
    
    if (isMycotoxinColumn(header)) {
      const toxinName = getMycotoxinName(header);
      if (toxinName) {
        mycotoxinIndices[toxinName] = index;
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
    // Fuzzy match variety to closest valid option
    const variety = varietyRaw ? findBestMatch(varietyRaw, VEGETATION_TYPES) : '';
    
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
    
    // Skip if critical fields are missing
    if (!province || !district || !variety) {
      return;
    }

    const generatedSampleId = getUniqueSampleId(sampleName, rowIndex);
    
    // Extract mycotoxin results
    const mycotoxins: ParsedSampleWithResults['mycotoxins'] = [];
    Object.entries(mycotoxinIndices).forEach(([toxinName, colIndex]) => {
      const value = parseMycotoxinValue(String(row[colIndex] ?? ''));
      if (value !== null && value > 0) {
        const config = MYCOTOXIN_CONFIGS[toxinName];
        mycotoxins.push({
          name: toxinName,
          intensity: Math.min(value, 10), // Normalize to 1-10 scale if needed
          threshold: config.threshold,
          unit: config.unit,
          dangerous: value > config.threshold,
          test_method: 'HPLC-FLD',
        });
      }
    });
    
    // Create sample
    const sample: ParsedSampleWithResults['sample'] = {
      sample_id: generatedSampleId,
      region: String(region),
      province,
      district,
      vegetation_variety: variety,
      collection_date: new Date().toISOString().split('T')[0],
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
