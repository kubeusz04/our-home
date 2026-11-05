import type { Apartment } from "./types";
export { parseProject, validateProject } from "./validation";
export function downloadJSON(a: Apartment) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(a, null, 2)], { type: "application/json" }),
  );
  const el = document.createElement("a");
  el.href = url;
  el.download = "nasz-dom.json";
  el.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
