/**
 * Mycotoxin Constants - Single Source of Truth for Frontend
 * Mirroring backend/samples/constants/mycotoxin_constants.py.
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
    maxThreshold: 20,
    unit: 'ug/kg',
    source: 'Gruber-Dorninger et al. 2019, Table 2',
  },
  DON: {
    name: 'Deoxynivalenol',
    shortName: 'DON',
    defaultThreshold: 900,
    maxThreshold: 8000,
    unit: 'ug/kg',
    source: 'Gruber-Dorninger et al. 2019, Table 2',
  },
  FB1: {
    name: 'Fumonisin B1',
    shortName: 'FB1',
    defaultThreshold: 2000,
    maxThreshold: 4000,
    unit: 'ug/kg',
    source: 'Gruber-Dorninger et al. 2019, Table 2',
  },
  ZEA: {
    name: 'Zearalenone',
    shortName: 'ZEA',
    defaultThreshold: 100,
    maxThreshold: 2000,
    unit: 'ug/kg',
    source: 'Gruber-Dorninger et al. 2019, Table 2',
  },
  OTA: {
    name: 'Ochratoxin A',
    shortName: 'OTA',
    defaultThreshold: 50,
    maxThreshold: 250,
    unit: 'ug/kg',
    source: 'Gruber-Dorninger et al. 2019, Table 2',
  },
  'T-2': {
    name: 'T-2 Toxin',
    shortName: 'T-2',
    defaultThreshold: 100,
    maxThreshold: 200,
    unit: 'ug/kg',
    source: 'Gruber-Dorninger et al. 2019, Table 2',
  },
  AFG1: {
    name: 'Aflatoxin G1',
    shortName: 'AFG1',
    defaultThreshold: 0,
    maxThreshold: 0,
    unit: 'ug/kg',
    source: 'No threshold data',
    isUncertain: true,
  },
  AFG2: {
    name: 'Aflatoxin G2',
    shortName: 'AFG2',
    defaultThreshold: 0,
    maxThreshold: 0,
    unit: 'ug/kg',
    source: 'No threshold data',
    isUncertain: true,
  },
  AFM1: {
    name: 'Aflatoxin M1',
    shortName: 'AFM1',
    defaultThreshold: 0,
    maxThreshold: 0,
    unit: 'ug/kg',
    source: 'No threshold data',
    isUncertain: true,
  },
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
