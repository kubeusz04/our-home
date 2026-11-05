import type { Apartment, Material, ProjectVersion } from "./types.ts";
const labels: Record<string, string> = {
  "Koncepcyjny apartament dla nas. Wszystkie wymiary są przykładowe.":
    "A concept apartment for us. All dimensions are illustrative.",
  "Sofa chmurka": "Cloud sofa",
  "Łóżko dwuosobowe": "Double bed",
  "Szafa dębowa": "Oak wardrobe",
  "Szafka nocna": "Bedside table",
  "Biurko z komputerem": "Desk with computer",
  "Krzesło tapicerowane": "Upholstered chair",
  "Niski stół": "Low table",
  "Regał otwarty": "Open shelving",
  "Lampa hanji": "Paper floor lamp",
  "Miękki dywan": "Soft rug",
  "Lniana zasłona": "Linen curtain",
  Lustro: "Mirror",
  "Frezje żółte": "Yellow freesias",
  "Frezje białe": "White freesias",
  "Frezje różowe": "Pink freesias",
  "Roślina doniczkowa": "Potted plant",
  "Szafka kuchenna": "Kitchen cabinet",
  "Umywalka / zlew": "Basin / sink",
  "Płyta grzewcza": "Cooktop",
  Lodówka: "Refrigerator",
  Wanna: "Bathtub",
  Toaleta: "Toilet",
  "Ekran projekcyjny": "Projection screen",
  "Stół jadalniany": "Dining table",
  "Kuchnia i jadalnia": "Kitchen & dining",
  "Gabinet / hobby": "Office / hobby",
  Sypialnia: "Bedroom",
  Łazienka: "Bathroom",
  Przedpokój: "Hallway",
  Balkon: "Balcony",
  Salon: "Living room",
  "Nasz projekt": "Our project",
  "Nasz Dom": "Our Home",
  Projektor: "Projector",
  Wazon: "Vase",
  "Nasze miejsce w Seulu": "Our project",
};
const materials: Record<string, string> = {
  drewno: "wood",
  tkanina: "fabric",
  ceramika: "ceramic",
  szkło: "glass",
  mat: "matte",
  smukły: "slim",
};
/** Translate only known defaults, preserving custom names, notes, IDs and layout. */
export function migrateEnglish(a: Apartment): Apartment {
  if (!a || typeof a !== "object") return a;
  a.name = labels[a.name] ?? a.name;
  a.notes = labels[a.notes] ?? a.notes;
  if (Array.isArray(a.rooms))
    for (const r of a.rooms) {
      if (r && typeof r === "object") r.name = labels[r.name] ?? r.name;
    }
  if (Array.isArray(a.furniture))
    for (const f of a.furniture) {
      if (!f || typeof f !== "object") continue;
      f.name = labels[f.name] ?? f.name;
      f.material = (materials[f.material] ?? f.material) as Material;
      f.vase = (materials[f.vase] ?? f.vase) as typeof f.vase;
    }
  return a;
}
export function migrateVersion(v: ProjectVersion): ProjectVersion {
  return {
    ...v,
    name: v.name.replace(/^Wariant /, "Version "),
    apartment: migrateEnglish(v.apartment),
  };
}
