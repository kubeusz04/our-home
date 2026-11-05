import Dexie, { type Table } from "dexie";
import type { Apartment, ProjectVersion } from "./types";
class HomeDatabase extends Dexie {
  projects!: Table<{ id: string; apartment: Apartment }>;
  versions!: Table<ProjectVersion>;
  constructor() {
    super("NaszDom");
    this.version(1).stores({ projects: "id", versions: "id,createdAt" });
  }
}
export const db = new HomeDatabase();
export async function saveProject(apartment: Apartment) {
  await db.projects.put({ id: "current", apartment });
}
