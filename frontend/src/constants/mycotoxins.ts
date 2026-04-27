/**
 * Mycotoxin Constants - Single Source of Truth for Frontend
 * Mirroring backend/samples/constants/mycotoxin_constants.py
 */

export interface ToxinMetadata {
  name: string;
  shortName: string;
  defaultThreshold: number;
  maxThreshold: number;
  unit: string;
  source: string;
  isUncertain?: boolean;
}

export const MYCOTOXIN_REGISTRY: Record<string, ToxinMetadata> = {
  AFB1: { 
    name: 'Aflatoxin B1', 
    shortName: 'AFB1', 
    defaultThreshold: 5, 
    maxThreshold: 50, 
    unit: 'ug/kg', 
    source: 'EU 2023/915' 
  },
  DON: { 
    name: 'Deoxynivalenol', 
    shortName: 'DON', 
    defaultThreshold: 1250, 
    maxThreshold: 5000, 
    unit: 'ug/kg', 
    source: 'EU 2023/915' 
  },
  FB1: { 
    name: 'Fumonisin B1', 
    shortName: 'FB1', 
    defaultThreshold: 0, 
    maxThreshold: 5000, 
    unit: 'ug/kg', 
    source: 'Adjusted to 0 for strict surveillance', 
    isUncertain: true 
  },
  ZEA: { 
    name: 'Zearalenone', 
    shortName: 'ZEA', 
    defaultThreshold: 200, 
    maxThreshold: 2000, 
    unit: 'ug/kg', 
    source: 'EU 2023/915' 
  },
  OTA: { 
    name: 'Ochratoxin A', 
    shortName: 'OTA', 
    defaultThreshold: 5, 
    maxThreshold: 100, 
    unit: 'ug/kg', 
    source: 'EU 2023/915' 
  },
  'T-2': { 
    name: 'T-2 Toxin', 
    shortName: 'T-2', 
    defaultThreshold: 50, 
    maxThreshold: 500, 
    unit: 'ug/kg', 
    source: 'EU 2023/915' 
  },
  AFG1: { 
    name: 'Aflatoxin G1', 
    shortName: 'AFG1', 
    defaultThreshold: 0, 
    maxThreshold: 50, 
    unit: 'ug/kg', 
    source: 'No Information', 
    isUncertain: true 
  },
  AFG2: { 
    name: 'Aflatoxin G2', 
    shortName: 'AFG2', 
    defaultThreshold: 0, 
    maxThreshold: 50, 
    unit: 'ug/kg', 
    source: 'No Information', 
    isUncertain: true 
  },
  AFM1: { 
    name: 'Aflatoxin M1', 
    shortName: 'AFM1', 
    defaultThreshold: 0.5, 
    maxThreshold: 10, 
    unit: 'ug/kg', 
    source: 'EU 2023/915' 
  }
};

// Aliases for data import mapping
export const MYCOTOXIN_ALIASES: Record<string, string[]> = {
  DON: ['don', 'deoxynivalenol'],
  AFB1: ['afb1', 'aflatoxin b1'],
  FB1: ['fb1', 'fumonisin b1'],
  'T-2': ['t-2', 't2', 't 2', 't-2 toxin', 't2 toxin'],
  ZEA: ['zea', 'zearalenone'],
  OTA: ['ota', 'ochratoxin a'],
  AF: ['af', 'aflatoxin'],
  AFG1: ['afg1', 'aflatoxin g1'],
  AFG2: ['afg2', 'aflatoxin g2'],
  AFM1: ['afm1', 'aflatoxin m1'],
};

// Helper for data import to get legacy config format
export const getMycotoxinConfigs = () => {
  const configs: Record<string, { threshold: number; unit: string }> = {};
  Object.entries(MYCOTOXIN_REGISTRY).forEach(([key, meta]) => {
    configs[key] = { threshold: meta.defaultThreshold, unit: 'ppb' }; // Mapping ppb to ug/kg
  });
  // Add fallback for 'AF' which isn't a single toxin but often used in imports
  configs['AF'] = { threshold: 5, unit: 'ppb' };
  return configs;
};
