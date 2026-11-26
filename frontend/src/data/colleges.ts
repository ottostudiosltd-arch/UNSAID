export interface OfficialCollege {
  code: string;
  name: string;
  shortName: string;
  slug: string;
}

export const OFFICIAL_COLLEGES: OfficialCollege[] = [
  {
    code: "06175",
    name: "PCCOE",
    shortName: "PCCOE",
    slug: "pccoe-06175",
  },
  {
    code: "06146",
    name: "MIT Academy of Engineering",
    shortName: "MIT AOE",
    slug: "mit-aoe-06146",
  },
  {
    code: "06141",
    name: "RSCOE, Tathawade",
    shortName: "RSCOE",
    slug: "rscoe-06141",
  },
  {
    code: "06139",
    name: "Modern College of Engineering",
    shortName: "Modern COE",
    slug: "modern-coe-06139",
  },
  {
    code: "06177",
    name: "Sinhgad College of Engineering",
    shortName: "SCOE",
    slug: "scoe-06177",
  },
  {
    code: "06178",
    name: "SKN College of Engineering",
    shortName: "SKNCOE",
    slug: "skncoe-06178",
  },
  {
    code: "06156",
    name: "MMCOE",
    shortName: "MMCOE",
    slug: "mmcoe-06156",
  },
  {
    code: "06155",
    name: "G.H. Raisoni College of Engineering & Management",
    shortName: "G.H. Raisoni",
    slug: "gh-raisoni-06155",
  },
  {
    code: "06145",
    name: "JSPM's Jaywantrao Sawant College of Engineering",
    shortName: "JSPM JSCOE",
    slug: "jspm-jscoe-06145",
  },
  {
    code: "06755",
    name: "JSPM Narhe Technical Campus",
    shortName: "JSPM Narhe",
    slug: "jspm-narhe-06755",
  },
  {
    code: "06298",
    name: "Zeal College of Engineering",
    shortName: "Zeal COE",
    slug: "zeal-coe-06298",
  },
  {
    code: "06307",
    name: "Dhole Patil College of Engineering",
    shortName: "DPCOE",
    slug: "dpcoe-06307",
  },
  {
    code: "06320",
    name: "KJ College of Engineering",
    shortName: "KJCOEMR",
    slug: "kjcoe-06320",
  },
  {
    code: "06311",
    name: "JSPM Bhivarabai Sawant Institute",
    shortName: "JSPM BSIOTR",
    slug: "jspm-bsiotr-06311",
  },
  {
    code: "06203",
    name: "MM Institute of Technology",
    shortName: "MMIT",
    slug: "mmit-06203",
  },
  {
    code: "06207",
    name: "D.Y. Patil Institute of Technology, Pimpri",
    shortName: "DYPIT Pimpri",
    slug: "dypit-pimpri-06207",
  },
  {
    code: "06754",
    name: "IIIT Pune",
    shortName: "IIIT Pune",
    slug: "iiit-pune-06754",
  },
  {
    code: "06732",
    name: "Ajeenkya DY Patil School of Engineering",
    shortName: "ADYPSOE",
    slug: "adypsoe-06732",
  },
];

export function findCollegeByCode(rawCode: string): OfficialCollege | null {
  const normalized = rawCode.trim().toUpperCase();
  return OFFICIAL_COLLEGES.find((c) => c.code === normalized) ?? null;
}
