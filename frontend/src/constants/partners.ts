/**
 * CoE-GFS international partner network.
 * Tuples: [flag, country, memberInstitutions[], googleMapsQuery]
 * The query targets the flagship member university / research institute.
 */
export const partnerDirectory: [string, string, string[], string][] = [
  ["🇹🇭", "Thailand", ["BIOTEC", "MTEC", "Prince of Songkla University", "Mahidol University", "Chulalongkorn University", "Kasetsart University", "Chiang Mai University", "PTT Oil and Retail Business", "Neogen Asia", "MDPI Bangkok", "FoSTAT"], "Thammasat University Faculty of Science and Technology Pathum Thani"],
  ["🇺🇸", "United States", ["CRDF Global", "University of British Columbia", "Oregon State University", "International Life Sciences Institute (ILSI)"], "Oregon State University Corvallis"],
  ["🇬🇧", "United Kingdom", ["Queen’s University Belfast", "University of Liverpool", "Bia Analytical"], "Queen's University Belfast"],
  ["🇮🇹", "Italy", ["University of Parma", "Barilla Group", "ISPA"], "University of Parma"],
  ["🇦🇹", "Austria", ["University of Vienna", "BOKU", "International Atomic Energy Agency"], "BOKU University Vienna"],
  ["🇨🇳", "China", ["China National Center for Food Safety Risk Assessment", "Pribolab", "Shaanxi University of Science and Technology", "Wuhan Polytechnic University", "Shandong Agricultural University"], "China National Center for Food Safety Risk Assessment Beijing"],
  ["🇯🇵", "Japan", ["Frontier Laboratories", "Teiko University", "Shizuoka University"], "Shizuoka University"],
  ["🇸🇬", "Singapore", ["SCIEX Singapore", "Agilent Technologies Singapore", "A*STAR", "Nanyang Technological University"], "A*STAR Singapore"],
  ["🇮🇪", "Ireland", ["University College Dublin"], "University College Dublin"],
  ["🇫🇷", "France", ["L’institut Agro Dijon"], "L'institut Agro Dijon"],
  ["🇧🇪", "Belgium", ["Ghent University"], "Ghent University"],
  ["🇨🇦", "Canada", ["International Union of Food Science and Technology"], "University of British Columbia Vancouver"],
  ["🇳🇵", "Nepal", ["Nepal Development Research Institute"], "Nepal Development Research Institute Kathmandu"],
  ["🇵🇾", "Paraguay", ["Microbioticos Paraguay"], "Microbioticos Paraguay Asuncion"],
  ["🇭🇰", "Hong Kong", ["Hong Kong Baptist University"], "Hong Kong Baptist University"],
  ["🇰🇷", "South Korea", ["Yonsei University"], "Yonsei University Seoul"],
  ["🇻🇳", "Vietnam", ["Phenikaa University", "Nong Lam University", "Hochiminh University"], "Phenikaa University Hanoi"],
  ["🇲🇾", "Malaysia", ["Universiti Putra Malaysia"], "Universiti Putra Malaysia"],
  ["🇮🇩", "Indonesia", ["Atma Jaya Catholic University of Indonesia", "Universitas Indonesia"], "Atma Jaya Catholic University Jakarta"],
  ["🇲🇲", "Myanmar", ["Myanmar Institute of Strategic and International Studies"], "Yangon Myanmar"],
];

/** Marker positions (institution city) with optional pill label offsets in px
 *  to keep neighbouring labels readable on a zoomed-out world map. */
export const partnerLocations: Record<string, { lat: number; lng: number; dx?: number; dy?: number }> = {
  Thailand: { lat: 14.0, lng: 100.6 },
  "United States": { lat: 43.9, lng: -120.5, dx: -10 },
  "United Kingdom": { lat: 53.0, lng: -1.5, dx: 34, dy: -14 },
  Italy: { lat: 42.8, lng: 12.8, dx: 6, dy: 24 },
  Austria: { lat: 47.6, lng: 14.1, dx: 40, dy: 12 },
  China: { lat: 35.0, lng: 105.0 },
  Japan: { lat: 36.2, lng: 138.3 },
  Singapore: { lat: 1.35, lng: 103.8 },
  Ireland: { lat: 53.3, lng: -8.0, dx: -26, dy: -20 },
  France: { lat: 46.5, lng: 2.5, dx: -30, dy: 18 },
  Belgium: { lat: 50.6, lng: 4.5, dx: 30, dy: 16 },
  Canada: { lat: 56.0, lng: -106.0 },
  Nepal: { lat: 28.2, lng: 84.0 },
  Paraguay: { lat: -23.4, lng: -58.4 },
  "Hong Kong": { lat: 22.3, lng: 114.2, dx: 30, dy: -16 },
  "South Korea": { lat: 36.5, lng: 127.8, dx: 34 },
  Vietnam: { lat: 16.5, lng: 107.8, dx: 30, dy: 12 },
  Malaysia: { lat: 3.1, lng: 101.7, dx: 26, dy: 14 },
  Indonesia: { lat: -2.5, lng: 118.0 },
  Myanmar: { lat: 21.0, lng: 96.0, dx: -30 },
};

/** Precise Google Maps queries for member institutions whose names alone
 *  would not resolve to their real location. Everything else falls back to
 *  "<institution> <country>". */
const institutionLocationOverrides: Record<string, string> = {
  BIOTEC: "BIOTEC NSTDA Thailand Science Park Pathum Thani",
  MTEC: "MTEC NSTDA Thailand Science Park Pathum Thani",
  "Prince of Songkla University": "Prince of Songkla University Hat Yai",
  "Mahidol University": "Mahidol University Salaya",
  "Chulalongkorn University": "Chulalongkorn University Bangkok",
  "Kasetsart University": "Kasetsart University Bangkok",
  "Chiang Mai University": "Chiang Mai University",
  "PTT Oil and Retail Business": "PTT Oil and Retail Business Bangkok",
  "MDPI Bangkok": "MDPI Bangkok Office",
  "L’institut Agro Dijon": "Institut Agro Dijon",
  "A*STAR": "A*STAR Biopolis Singapore",
  "Hong Kong Baptist University": "Hong Kong Baptist University Kowloon Tong",
};

export const institutionMapsQuery = (institution: string, country: string): string =>
  institutionLocationOverrides[institution] ?? `${institution} ${country}`;
