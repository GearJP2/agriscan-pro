// Thailand provinces and their districts
// Organized by region for easy selection

export interface ThailandLocation {
  province: string;
  districts: string[];
  region: string;
}

export const thailandLocations: ThailandLocation[] = [
  // Northern Region
  { province: 'Chiang Mai', districts: ['Mueang Chiang Mai', 'Chom Thong', 'Mae Chaem', 'Chiang Dao', 'Doi Saket', 'Mae Taeng', 'Mae Rim', 'Samoeng', 'Fang', 'Mae Ai', 'Phrao', 'San Pa Tong', 'San Kamphaeng', 'San Sai', 'Hang Dong', 'Hot', 'Doi Tao', 'Omkoi', 'Saraphi', 'Wiang Haeng', 'Chai Prakan', 'Mae Wang', 'Mae On', 'Doi Lo', 'Galyani Vadhana'], region: 'Northern' },
  { province: 'Chiang Rai', districts: ['Mueang Chiang Rai', 'Wiang Chai', 'Chiang Khong', 'Thoeng', 'Phan', 'Pa Daet', 'Mae Chan', 'Chiang Saen', 'Mae Sai', 'Mae Suai', 'Wiang Pa Pao', 'Phaya Mengrai', 'Wiang Kaen', 'Khun Tan', 'Mae Fa Luang', 'Mae Lao', 'Wiang Chiang Rung', 'Doi Luang'], region: 'Northern' },
  { province: 'Lampang', districts: ['Mueang Lampang', 'Mae Mo', 'Ko Kha', 'Soem Ngam', 'Ngao', 'Chae Hom', 'Wang Nuea', 'Thoen', 'Mae Phrik', 'Mae Tha', 'Sop Prap', 'Hang Chat', 'Mueang Pan'], region: 'Northern' },
  { province: 'Lamphun', districts: ['Mueang Lamphun', 'Mae Tha', 'Ban Hong', 'Li', 'Thung Hua Chang', 'Pa Sang', 'Ban Thi', 'Wiang Nong Long'], region: 'Northern' },
  { province: 'Mae Hong Son', districts: ['Mueang Mae Hong Son', 'Khun Yuam', 'Pai', 'Mae Sariang', 'Mae La Noi', 'Sop Moei', 'Pangmapha'], region: 'Northern' },
  { province: 'Nan', districts: ['Mueang Nan', 'Mae Charim', 'Ban Luang', 'Na Noi', 'Pua', 'Tha Wang Pha', 'Wiang Sa', 'Thung Chang', 'Chiang Klang', 'Na Muen', 'Santi Suk', 'Bo Kluea', 'Song Khwae', 'Phu Phiang', 'Chaloem Phra Kiat'], region: 'Northern' },
  { province: 'Phayao', districts: ['Mueang Phayao', 'Chun', 'Chiang Kham', 'Chiang Muan', 'Dok Khamtai', 'Pong', 'Mae Chai', 'Phu Sang', 'Phu Kamyao'], region: 'Northern' },
  { province: 'Phrae', districts: ['Mueang Phrae', 'Rong Kwang', 'Long', 'Sung Men', 'Den Chai', 'Song', 'Wang Chin', 'Nong Muang Khai'], region: 'Northern' },
  { province: 'Uttaradit', districts: ['Mueang Uttaradit', 'Tron', 'Tha Pla', 'Nam Pat', 'Fak Tha', 'Ban Khok', 'Phichai', 'Laplae', 'Thong Saen Khan'], region: 'Northern' },
  
  // Northeastern Region (Isan)
  { province: 'Khon Kaen', districts: ['Mueang Khon Kaen', 'Ban Fang', 'Phra Yuen', 'Nong Ruea', 'Chum Phae', 'Si Chomphu', 'Nam Phong', 'Ubol Ratana', 'Kranuan', 'Ban Phai', 'Phon', 'Waeng Yai', 'Waeng Noi', 'Nong Song Hong', 'Phu Wiang', 'Mancha Khiri', 'Chonnabot', 'Khao Suan Kwang', 'Phu Pha Man', 'Sam Sung', 'Khok Pho Chai', 'Nong Na Kham', 'Ban Haet', 'Non Sila', 'Wiang Kao', 'Pueai Noi'], region: 'Northeastern' },
  { province: 'Nakhon Ratchasima', districts: ['Mueang Nakhon Ratchasima', 'Khon Buri', 'Soeng Sang', 'Khong', 'Ban Lueam', 'Chakkarat', 'Chok Chai', 'Dan Khun Thot', 'Non Thai', 'Non Sung', 'Kham Sakaesaeng', 'Bua Yai', 'Prathai', 'Pak Thong Chai', 'Phimai', 'Huai Thalaeng', 'Chum Phuang', 'Sung Noen', 'Kham Thale So', 'Sikhiu', 'Pak Chong', 'Nong Bunnak', 'Kaeng Sanam Nang', 'Non Daeng', 'Wang Nam Khiao', 'Thepharak', 'Mueang Yang', 'Phra Thong Kham', 'Lam Thamenchai', 'Bua Lai', 'Sida', 'Chaloem Phra Kiat'], region: 'Northeastern' },
  { province: 'Udon Thani', districts: ['Mueang Udon Thani', 'Kut Chap', 'Nong Wua So', 'Kumphawapi', 'Non Sa-at', 'Nong Han', 'Thung Fon', 'Chai Wan', 'Si That', 'Wang Sam Mo', 'Ban Dung', 'Ban Phue', 'Nam Som', 'Phen', 'Sang Khom', 'Nong Saeng', 'Na Yung', 'Phibun Rak', 'Ku Kaeo', 'Prachak Sinlapakhom'], region: 'Northeastern' },
  { province: 'Ubon Ratchathani', districts: ['Mueang Ubon Ratchathani', 'Si Mueang Mai', 'Khong Chiam', 'Khueang Nai', 'Khemarat', 'Det Udom', 'Na Chaluai', 'Nam Yuen', 'Boontharik', 'Trakan Phuet Phon', 'Kut Khaopun', 'Muang Sam Sip', 'Warin Chamrap', 'Phibun Mangsahan', 'Tan Sum', 'Pho Sai', 'Samrong', 'Don Mot Daeng', 'Sirindhorn', 'Thung Si Udom', 'Na Yia', 'Na Tan', 'Lao Suea Kok', 'Sawang Wirawong', 'Nam Khun'], region: 'Northeastern' },
  { province: 'Buriram', districts: ['Mueang Buriram', 'Khu Mueang', 'Krasang', 'Nang Rong', 'Nong Ki', 'Lahan Sai', 'Prakhon Chai', 'Ban Kruat', 'Phutthaisong', 'Lam Plai Mat', 'Satuek', 'Pakham', 'Na Pho', 'Nong Hong', 'Phlapphla Chai', 'Huai Rat', 'Non Suwan', 'Chamni', 'Ban Mai Chaiyaphot', 'Non Din Daeng', 'Ban Dan', 'Khaen Dong', 'Chaloem Phra Kiat'], region: 'Northeastern' },
  { province: 'Surin', districts: ['Mueang Surin', 'Chumphon Buri', 'Tha Tum', 'Chom Phra', 'Prasat', 'Kap Choeng', 'Rattanaburi', 'Sanom', 'Sikhoraphum', 'Sangkha', 'Lamduan', 'Samrong Thap', 'Buachet', 'Phanom Dong Rak', 'Si Narong', 'Khwao Sinarin', 'Non Narai'], region: 'Northeastern' },
  
  // Central Region
  { province: 'Bangkok', districts: ['Phra Nakhon', 'Dusit', 'Nong Chok', 'Bang Rak', 'Bang Khen', 'Bang Kapi', 'Pathum Wan', 'Pom Prap Sattru Phai', 'Phra Khanong', 'Min Buri', 'Lat Krabang', 'Yan Nawa', 'Samphanthawong', 'Phaya Thai', 'Thon Buri', 'Bangkok Yai', 'Huai Khwang', 'Khlong San', 'Taling Chan', 'Bangkok Noi', 'Bang Khun Thian', 'Phasi Charoen', 'Nong Khaem', 'Rat Burana', 'Bang Phlat', 'Din Daeng', 'Bueng Kum', 'Sathon', 'Bang Sue', 'Chatuchak', 'Bang Kho Laem', 'Prawet', 'Khlong Toei', 'Suan Luang', 'Chom Thong', 'Don Mueang', 'Ratchathewi', 'Lat Phrao', 'Watthana', 'Bang Khae', 'Lak Si', 'Sai Mai', 'Khan Na Yao', 'Saphan Sung', 'Wang Thonglang', 'Khlong Sam Wa', 'Bang Na', 'Thawi Watthana', 'Thung Khru', 'Bang Bon'], region: 'Central' },
  { province: 'Nonthaburi', districts: ['Mueang Nonthaburi', 'Bang Kruai', 'Bang Yai', 'Bang Bua Thong', 'Sai Noi', 'Pak Kret'], region: 'Central' },
  { province: 'Pathum Thani', districts: ['Mueang Pathum Thani', 'Khlong Luang', 'Thanyaburi', 'Nong Suea', 'Lat Lum Kaeo', 'Lam Luk Ka', 'Sam Khok'], region: 'Central' },
  { province: 'Samut Prakan', districts: ['Mueang Samut Prakan', 'Bang Bo', 'Bang Phli', 'Phra Pradaeng', 'Phra Samut Chedi', 'Bang Sao Thong'], region: 'Central' },
  { province: 'Ayutthaya', districts: ['Phra Nakhon Si Ayutthaya', 'Tha Ruea', 'Nakhon Luang', 'Bang Sai', 'Bang Ban', 'Bang Pa-in', 'Bang Pahan', 'Phak Hai', 'Phachi', 'Lat Bua Luang', 'Wang Noi', 'Sena', 'Bang Sai (Saraburi)', 'Uthai', 'Maharat', 'Ban Phraek'], region: 'Central' },
  { province: 'Nakhon Pathom', districts: ['Mueang Nakhon Pathom', 'Kamphaeng Saen', 'Nakhon Chai Si', 'Don Tum', 'Bang Len', 'Sam Phran', 'Phutthamonthon'], region: 'Central' },
  { province: 'Saraburi', districts: ['Mueang Saraburi', 'Kaeng Khoi', 'Nong Khae', 'Wihan Daeng', 'Nong Saeng', 'Ban Mo', 'Don Phut', 'Nong Don', 'Phra Phutthabat', 'Sao Hai', 'Muak Lek', 'Wang Muang', 'Chaloem Phra Kiat'], region: 'Central' },
  
  // Eastern Region
  { province: 'Chonburi', districts: ['Mueang Chonburi', 'Ban Bueng', 'Nong Yai', 'Bang Lamung', 'Phan Thong', 'Phanat Nikhom', 'Si Racha', 'Ko Sichang', 'Sattahip', 'Bo Thong', 'Ko Chan'], region: 'Eastern' },
  { province: 'Rayong', districts: ['Mueang Rayong', 'Ban Chang', 'Klaeng', 'Wang Chan', 'Ban Khai', 'Pluak Daeng', 'Khao Chamao', 'Nikhom Phatthana'], region: 'Eastern' },
  { province: 'Chanthaburi', districts: ['Mueang Chanthaburi', 'Khlung', 'Tha Mai', 'Pong Nam Ron', 'Makham', 'Laem Sing', 'Soi Dao', 'Kaeng Hang Maeo', 'Na Yai Am', 'Khao Khitchakut'], region: 'Eastern' },
  { province: 'Trat', districts: ['Mueang Trat', 'Khlong Yai', 'Khao Saming', 'Bo Rai', 'Laem Ngop', 'Ko Kut', 'Ko Chang'], region: 'Eastern' },
  { province: 'Prachinburi', districts: ['Mueang Prachinburi', 'Kabin Buri', 'Na Di', 'Ban Sang', 'Prachantakham', 'Si Maha Phot', 'Si Mahosot'], region: 'Eastern' },
  { province: 'Sa Kaeo', districts: ['Mueang Sa Kaeo', 'Khlong Hat', 'Ta Phraya', 'Wang Nam Yen', 'Watthana Nakhon', 'Aranyaprathet', 'Khao Chakan', 'Khok Sung', 'Wang Sombun'], region: 'Eastern' },
  
  // Western Region
  { province: 'Kanchanaburi', districts: ['Mueang Kanchanaburi', 'Sai Yok', 'Bo Phloi', 'Si Sawat', 'Tha Maka', 'Tha Muang', 'Thong Pha Phum', 'Sangkhla Buri', 'Phanom Thuan', 'Lao Khwan', 'Dan Makham Tia', 'Nong Prue', 'Huai Krachao'], region: 'Western' },
  { province: 'Ratchaburi', districts: ['Mueang Ratchaburi', 'Chom Bueng', 'Suan Phueng', 'Damnoen Saduak', 'Ban Pong', 'Bang Phae', 'Photharam', 'Pak Tho', 'Wat Phleng', 'Ban Kha'], region: 'Western' },
  { province: 'Phetchaburi', districts: ['Mueang Phetchaburi', 'Khao Yoi', 'Nong Ya Plong', 'Cha-am', 'Tha Yang', 'Ban Lat', 'Ban Laem', 'Kaeng Krachan'], region: 'Western' },
  { province: 'Prachuap Khiri Khan', districts: ['Mueang Prachuap Khiri Khan', 'Kui Buri', 'Thap Sakae', 'Bang Saphan', 'Bang Saphan Noi', 'Pran Buri', 'Hua Hin', 'Sam Roi Yot'], region: 'Western' },
  
  // Southern Region
  { province: 'Surat Thani', districts: ['Mueang Surat Thani', 'Kanchanadit', 'Don Sak', 'Ko Samui', 'Ko Pha-ngan', 'Chaiya', 'Tha Chana', 'Khiri Rat Nikhom', 'Ban Ta Khun', 'Phanom', 'Tha Chang', 'Ban Na San', 'Ban Na Doem', 'Khian Sa', 'Wiang Sa', 'Phrasaeng', 'Phunphin', 'Chai Buri', 'Vibhavadi'], region: 'Southern' },
  { province: 'Nakhon Si Thammarat', districts: ['Mueang Nakhon Si Thammarat', 'Phrom Khiri', 'Lan Saka', 'Chawang', 'Phipun', 'Chian Yai', 'Cha-uat', 'Tha Sala', 'Thung Song', 'Na Bon', 'Thung Yai', 'Pak Phanang', 'Ron Phibun', 'Sichon', 'Khanom', 'Hua Sai', 'Bang Khan', 'Tham Phannara', 'Chang Klang', 'Chulabhorn', 'Phra Phrom', 'Nop Phitam', 'Chaloem Phra Kiat'], region: 'Southern' },
  { province: 'Phuket', districts: ['Mueang Phuket', 'Kathu', 'Thalang'], region: 'Southern' },
  { province: 'Krabi', districts: ['Mueang Krabi', 'Khao Phanom', 'Ko Lanta', 'Khlong Thom', 'Ao Luek', 'Plai Phraya', 'Lam Thap', 'Nuea Khlong'], region: 'Southern' },
  { province: 'Songkhla', districts: ['Mueang Songkhla', 'Sathing Phra', 'Chana', 'Na Thawi', 'Thepha', 'Saba Yoi', 'Ranot', 'Krasae Sin', 'Rattaphum', 'Sadao', 'Hat Yai', 'Na Mom', 'Khuan Niang', 'Bang Klam', 'Singhanakhon', 'Khlong Hoi Khong'], region: 'Southern' },
  { province: 'Trang', districts: ['Mueang Trang', 'Kantang', 'Yan Ta Khao', 'Palian', 'Sikao', 'Huai Yot', 'Wang Wiset', 'Na Yong', 'Ratsada', 'Hat Samran'], region: 'Southern' },
];

// Helper function to get all provinces
export const getAllProvinces = (): string[] => {
  return thailandLocations.map(loc => loc.province).sort();
};

// Helper function to get provinces by region
export const getProvincesByRegion = (region: string): string[] => {
  return thailandLocations
    .filter(loc => loc.region === region)
    .map(loc => loc.province)
    .sort();
};

// Helper function to get districts by province
export const getDistrictsByProvince = (province: string): string[] => {
  const location = thailandLocations.find(loc => loc.province === province);
  return location ? location.districts.sort() : [];
};

// Helper function to get region by province
export const getRegionByProvince = (province: string): string | undefined => {
  const location = thailandLocations.find(loc => loc.province === province);
  return location?.region;
};

// Helper function to get province by district (finds first match)
export const getProvinceByDistrict = (district: string): string | undefined => {
  for (const loc of thailandLocations) {
    if (loc.districts.includes(district)) {
      return loc.province;
    }
  }
  return undefined;
};

// Get all unique regions
export const getAllRegions = (): string[] => {
  return [...new Set(thailandLocations.map(loc => loc.region))].sort();
};
