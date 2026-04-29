import type {
  KPIData,
  ProvinceRisk,
  ProvinceRank,
  HealthSummary,
  ToxinScore,
  CommodityShare,
  ThresholdData,
  HeatmapCell,
  CoContamSummary,
  CoOccurrence,
  NetworkData,
  ToxinDist,
} from '@/types/dashboard';

// ── Section 1: KPI Cards ─────────────────────────────────────────────

export const kpiData: KPIData = {
  cards: [
    {
      label: 'Total Samples Reported',
      value: '4,821',
      delta: 12,
      deltaDirection: 'up',
      isImprovement: null,
      context: 'vs. Q3 2024',
    },
    {
      label: '% Positive Samples',
      value: '67.3%',
      delta: 3.1,
      deltaDirection: 'up',
      isImprovement: false,
      context: 'vs. Q3 2024',
    },
    {
      label: '% Above Safety Threshold',
      value: '28.4%',
      delta: -1.2,
      deltaDirection: 'down',
      isImprovement: true,
      context: 'vs. Q3 2024',
    },
    {
      label: 'High Risk Regions',
      value: 14,
      delta: 2,
      deltaDirection: 'up',
      isImprovement: false,
      context: 'vs. Q3 2024',
    },
    {
      label: 'Highest Risk Commodity',
      value: 'Maize',
      delta: null,
      deltaDirection: null,
      isImprovement: null,
      context: 'Consistent since Q2 2024',
    },
    {
      label: 'Active Alerts',
      value: 7,
      delta: 3,
      deltaDirection: 'up',
      isImprovement: false,
      context: 'vs. Q3 2024',
      accent: 'red',
    },
  ],
};

// ── Section 2: Province Risk Data ────────────────────────────────────

const regions = ['North', 'Northeast', 'Central', 'East', 'West', 'South'];

const provincesByRegion: Record<string, string[]> = {
  North: [
    'Chiang Rai', 'Chiang Mai', 'Lampang', 'Lamphun', 'Mae Hong Son',
    'Nan', 'Phayao', 'Phrae', 'Uttaradit',
  ],
  Northeast: [
    'Khon Kaen', 'Nakhon Ratchasima', 'Udon Thani', 'Ubon Ratchathani',
    'Sakon Nakhon', 'Nakhon Phanom', 'Kalasin', 'Maha Sarakham',
    'Roi Et', 'Chaiyaphum', 'Loei', 'Nong Khai', 'Nong Bua Lamphu',
    'Bueng Kan', 'Mukdahan', 'Yasothon', 'Amnat Charoen', 'Surin',
    'Si Sa Ket', 'Buri Ram',
  ],
  Central: [
    'Bangkok', 'Nonthaburi', 'Pathum Thani', 'Samut Prakan',
    'Nakhon Pathom', 'Samut Sakhon', 'Samut Songkhram', 'Ayutthaya',
    'Ang Thong', 'Lop Buri', 'Sing Buri', 'Chai Nat', 'Saraburi',
    'Nakhon Nayok', 'Nakhon Sawan', 'Uthai Thani', 'Kamphaeng Phet',
    'Tak', 'Sukhothai', 'Phitsanulok', 'Phichit', 'Phetchabun',
  ],
  East: [
    'Chon Buri', 'Rayong', 'Chanthaburi', 'Trat', 'Sa Kaeo',
    'Chachoengsao', 'Prachin Buri',
  ],
  West: [
    'Kanchanaburi', 'Ratchaburi', 'Suphan Buri', 'Phetchaburi',
    'Prachuap Khiri Khan',
  ],
  South: [
    'Nakhon Si Thammarat', 'Surat Thani', 'Songkhla', 'Phuket',
    'Krabi', 'Phang Nga', 'Ranong', 'Chumphon', 'Trang',
    'Pattani', 'Yala', 'Narathiwat', 'Satun', 'Phatthalung',
  ],
};

const toxins = ['AFB1', 'FUM', 'OTA', 'DON', 'ZEA'];
const commodities = ['Maize', 'Peanuts', 'Rice', 'Animal Feed', 'Others'];

function assignRisk(province: string, region: string): ProvinceRisk {
  const criticalProvinces = ['Chiang Rai', 'Chiang Mai', 'Khon Kaen', 'Nakhon Ratchasima'];
  const highProvinces = [
    'Lampang', 'Nan', 'Udon Thani', 'Ubon Ratchathani', 'Sakon Nakhon',
    'Chaiyaphum', 'Phrae', 'Loei', 'Buri Ram', 'Surin',
  ];

  let riskLevel: ProvinceRisk['riskLevel'];
  let sampleCount: number;
  let aboveThresholdPct: number;

  if (criticalProvinces.includes(province)) {
    riskLevel = 'critical';
    sampleCount = 250 + Math.floor(Math.random() * 100);
    aboveThresholdPct = 55 + Math.floor(Math.random() * 20);
  } else if (highProvinces.includes(province)) {
    riskLevel = 'high';
    sampleCount = 120 + Math.floor(Math.random() * 100);
    aboveThresholdPct = 35 + Math.floor(Math.random() * 20);
  } else if (region === 'North' || region === 'Northeast') {
    riskLevel = 'medium';
    sampleCount = 50 + Math.floor(Math.random() * 80);
    aboveThresholdPct = 20 + Math.floor(Math.random() * 15);
  } else {
    riskLevel = 'low';
    sampleCount = 20 + Math.floor(Math.random() * 50);
    aboveThresholdPct = 5 + Math.floor(Math.random() * 15);
  }

  return {
    name: province,
    nameEn: province,
    region,
    riskLevel,
    sampleCount,
    positiveCount: Math.round((sampleCount * Math.max(aboveThresholdPct, 20)) / 100),
    positivePct: Math.max(aboveThresholdPct, 20),
    aboveThresholdPct,
    dominantToxin: riskLevel === 'critical' ? 'AFB1' : toxins[Math.floor(Math.random() * toxins.length)],
    dominantCommodity: riskLevel === 'critical' || riskLevel === 'high'
      ? 'Maize'
      : commodities[Math.floor(Math.random() * commodities.length)],
  };
}

// Seed a deterministic random (use simple hash for consistency)
export const provinceRiskData: ProvinceRisk[] = [];
for (const [region, provinces] of Object.entries(provincesByRegion)) {
  for (const province of provinces) {
    provinceRiskData.push(assignRisk(province, region));
  }
}

export const topProvinces: ProvinceRank[] = [
  { rank: 1, province: 'Chiang Rai', sampleCount: 312, aboveThresholdPct: 72.1, dominantToxin: 'AFB1', riskLevel: 'critical' },
  { rank: 2, province: 'Khon Kaen', sampleCount: 287, aboveThresholdPct: 68.4, dominantToxin: 'AFB1', riskLevel: 'critical' },
  { rank: 3, province: 'Chiang Mai', sampleCount: 265, aboveThresholdPct: 61.8, dominantToxin: 'AFB1', riskLevel: 'critical' },
  { rank: 4, province: 'Nakhon Ratchasima', sampleCount: 251, aboveThresholdPct: 58.2, dominantToxin: 'FUM', riskLevel: 'critical' },
  { rank: 5, province: 'Udon Thani', sampleCount: 198, aboveThresholdPct: 49.7, dominantToxin: 'AFB1', riskLevel: 'high' },
];

// ── Section 3: Public Health Summary ─────────────────────────────────

export const publicHealthSummary: HealthSummary = {
  riskDrivers: [
    'Aflatoxin B1 contamination rising in maize (+18% YoY)',
    'Post-harvest storage failures in upper-north provinces',
    'High humidity season extending risk window by ~3 weeks',
    'Fumonisin co-contamination amplifying health risk in animal feed',
  ],
  affectedCommodities: [
    { name: 'Maize', pct: 78 },
    { name: 'Peanuts', pct: 61 },
    { name: 'Animal Feed', pct: 52 },
    { name: 'Rice', pct: 44 },
  ],
  impactedPopulations: [
    { group: 'Farming communities (North/NE Thailand)', severity: 'High' },
    { group: 'Animal feed producers', severity: 'High' },
    { group: 'Export supply chain (EU/ASEAN)', severity: 'Medium' },
    { group: 'Young children & infants (aflatoxin exposure)', severity: 'High' },
  ],
};

// ── Section 4: Mycotoxin & Commodity Analysis ────────────────────────

export const mycotoxinBarData: ToxinScore[] = [
  { name: 'Aflatoxin B1', shortName: 'AFB1', score: 82, severity: 'critical' },
  { name: 'Fumonisin B1', shortName: 'FUM', score: 67, severity: 'high' },
  { name: 'Ochratoxin A', shortName: 'OTA', score: 45, severity: 'medium' },
  { name: 'Deoxynivalenol', shortName: 'DON', score: 38, severity: 'medium' },
  { name: 'Zearalenone', shortName: 'ZEA', score: 29, severity: 'low' },
];

export const commodityShare: CommodityShare[] = [
  { name: 'Maize', value: 38, color: '#ef4444' },
  { name: 'Peanuts', value: 24, color: '#f59e0b' },
  { name: 'Rice', value: 19, color: '#22c55e' },
  { name: 'Animal Feed', value: 14, color: '#3b82f6' },
  { name: 'Others', value: 5, color: '#6b7280' },
];

export const thresholdByCommodity: ThresholdData[] = [
  { commodity: 'Maize', pctAbove: 62, totalCount: 1200, aboveCount: 744 },
  { commodity: 'Peanuts', pctAbove: 41, totalCount: 850, aboveCount: 348 },
  { commodity: 'Animal Feed', pctAbove: 38, totalCount: 920, aboveCount: 350 },
  { commodity: 'Rice', pctAbove: 22, totalCount: 1100, aboveCount: 242 },
  { commodity: 'Others', pctAbove: 14, totalCount: 750, aboveCount: 105 },
];

export const heatmapData: HeatmapCell[] = [
  // North
  { region: 'North', commodity: 'Maize', intensity: 92 },
  { region: 'North', commodity: 'Peanuts', intensity: 68 },
  { region: 'North', commodity: 'Rice', intensity: 34 },
  { region: 'North', commodity: 'Animal Feed', intensity: 71 },
  { region: 'North', commodity: 'Others', intensity: 18 },
  // Northeast
  { region: 'Northeast', commodity: 'Maize', intensity: 87 },
  { region: 'Northeast', commodity: 'Peanuts', intensity: 58 },
  { region: 'Northeast', commodity: 'Rice', intensity: 45 },
  { region: 'Northeast', commodity: 'Animal Feed', intensity: 63 },
  { region: 'Northeast', commodity: 'Others', intensity: 22 },
  // Central
  { region: 'Central', commodity: 'Maize', intensity: 41 },
  { region: 'Central', commodity: 'Peanuts', intensity: 32 },
  { region: 'Central', commodity: 'Rice', intensity: 28 },
  { region: 'Central', commodity: 'Animal Feed', intensity: 35 },
  { region: 'Central', commodity: 'Others', intensity: 12 },
  // East
  { region: 'East', commodity: 'Maize', intensity: 35 },
  { region: 'East', commodity: 'Peanuts', intensity: 27 },
  { region: 'East', commodity: 'Rice', intensity: 19 },
  { region: 'East', commodity: 'Animal Feed', intensity: 30 },
  { region: 'East', commodity: 'Others', intensity: 8 },
  // West
  { region: 'West', commodity: 'Maize', intensity: 44 },
  { region: 'West', commodity: 'Peanuts', intensity: 38 },
  { region: 'West', commodity: 'Rice', intensity: 21 },
  { region: 'West', commodity: 'Animal Feed', intensity: 33 },
  { region: 'West', commodity: 'Others', intensity: 15 },
  // South
  { region: 'South', commodity: 'Maize', intensity: 18 },
  { region: 'South', commodity: 'Peanuts', intensity: 22 },
  { region: 'South', commodity: 'Rice', intensity: 31 },
  { region: 'South', commodity: 'Animal Feed', intensity: 14 },
  { region: 'South', commodity: 'Others', intensity: 9 },
];

// ── Section 5: Co-contamination Analysis ─────────────────────────────

export const coContamSummary: CoContamSummary = {
  avgToxinsPerSample: 1.8,
  pctTwoPlus: 36.6,
  pctThreePlus: 10.0,
  mostCommonPair: 'AFB1 + FUM',
};

export const coOccurrenceList: CoOccurrence[] = [
  { toxins: ['AFB1', 'FUM'], sampleCount: 412, pct: 18.4 },
  { toxins: ['AFB1', 'ZEA'], sampleCount: 298, pct: 13.3 },
  { toxins: ['FUM', 'DON'], sampleCount: 187, pct: 8.3 },
  { toxins: ['AFB1', 'FUM', 'ZEA'], sampleCount: 94, pct: 4.2 },
  { toxins: ['OTA', 'DON'], sampleCount: 76, pct: 3.4 },
];

export const TOXIN_COLORS: Record<string, string> = {
  AFB1: '#ef4444',
  FUM: '#f97316',
  OTA: '#a855f7',
  DON: '#3b82f6',
  ZEA: '#eab308',
};

export const networkData: NetworkData = {
  nodes: [
    { id: 'AFB1', frequency: 82, color: '#ef4444' },
    { id: 'FUM', frequency: 67, color: '#f97316' },
    { id: 'OTA', frequency: 45, color: '#a855f7' },
    { id: 'DON', frequency: 38, color: '#3b82f6' },
    { id: 'ZEA', frequency: 29, color: '#eab308' },
  ],
  links: [
    { source: 'AFB1', target: 'FUM', value: 412 },
    { source: 'AFB1', target: 'ZEA', value: 298 },
    { source: 'FUM', target: 'DON', value: 187 },
    { source: 'AFB1', target: 'OTA', value: 112 },
    { source: 'FUM', target: 'ZEA', value: 94 },
    { source: 'OTA', target: 'DON', value: 76 },
    { source: 'DON', target: 'ZEA', value: 58 },
  ],
};

export const toxinsPerSample: ToxinDist[] = [
  { count: '1', pct: 63.4 },
  { count: '2', pct: 26.6, highlight: true },
  { count: '3', pct: 7.8 },
  { count: '4+', pct: 2.2 },
];

// ── Filter helpers ───────────────────────────────────────────────────

export const ALL_COMMODITIES = ['Maize', 'Peanuts', 'Rice', 'Animal Feed', 'Others'];
export const ALL_REGIONS = regions;
export const QUARTERS = ['Q4 2024', 'Q3 2024', 'Q2 2024', 'Q1 2024'];
