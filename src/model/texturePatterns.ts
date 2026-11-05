import type { TexturePreset } from "./types";
const cache = new Map<string, HTMLCanvasElement>();
export function patternCanvas(pattern: TexturePreset) {
  if (cache.has(pattern)) return cache.get(pattern)!;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f8f6ef";
  g.fillRect(0, 0, 256, 256);
  if (pattern === "wood") {
    g.fillStyle = "#e8e0d1";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 80; i++) {
      g.strokeStyle = `rgba(89,63,33,${0.12 + (i % 5) * 0.04})`;
      g.lineWidth = i % 8 === 0 ? 1.8 : 0.6;
      g.beginPath();
      for (let y = 0; y <= 256; y += 4) {
        const x = i * 3.3 + Math.sin(y / 45 + i * 0.7) * 2.2;
        if (y) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
    }
    g.fillStyle = "#77654944";
    g.fillRect(0, 0, 2, 256);
  } else if (pattern === "linen") {
    g.fillStyle = "#ebe7dc";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 256; i += 4) {
      g.fillStyle = i % 8 ? "#fff8" : "#635d4a35";
      g.fillRect(i, 0, 1, 256);
      g.fillRect(0, i, 256, 1);
    }
  } else if (pattern === "tiles" || pattern === "brick") {
    const h = pattern === "tiles" ? 64 : 40,
      w = pattern === "tiles" ? 64 : 128;
    g.fillStyle = "#999587";
    g.fillRect(0, 0, 256, 256);
    for (let row = -1; row < 8; row++)
      for (let col = -1; col < 5; col++) {
        const shift = pattern === "brick" && row % 2 ? w / 2 : 0;
        g.fillStyle = ["#e9e4d9", "#d8d1c5", "#f4f0e6"][(row + col + 9) % 3];
        g.fillRect(col * w + shift + 2, row * h + 2, w - 4, h - 4);
      }
  } else if (pattern === "concrete") {
    g.fillStyle = "#cbc9c0";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 14000; i++) {
      const x = (i * 73) % 256,
        y = (i * 131 + Math.floor(i / 256) * 19) % 256;
      g.fillStyle = `rgba(${i % 2 ? 50 : 255},${i % 2 ? 50 : 255},${i % 2 ? 50 : 255},${0.03 + (i % 7) * 0.012})`;
      g.fillRect(x, y, 1 + (i % 3), 1 + (i % 3));
    }
  } else if (pattern === "marble") {
    g.fillStyle = "#f1eee6";
    g.fillRect(0, 0, 256, 256);
    for (let i = -5; i < 12; i++) {
      g.strokeStyle = i % 3 ? "#9e9b9455" : "#b6a58b77";
      g.lineWidth = i % 3 ? 0.8 : 2;
      g.beginPath();
      for (let x = -20; x <= 280; x += 3) {
        const y =
          i * 29 + x * 0.7 + Math.sin(x / 35 + i) * 16 + Math.sin(x / 12) * 3;
        if (x === -20) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
  } else if (pattern === "stripes") {
    g.fillStyle = "#eee7d9";
    g.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 32) {
      g.fillStyle = "#b7b7a5";
      g.fillRect(x, 0, 14, 256);
      g.fillStyle = "#faf6e9";
      g.fillRect(x + 16, 0, 2, 256);
    }
  }
  cache.set(pattern, c);
  return c;
}
const previews = new Map<string, string>();
export function patternPreview(pattern: TexturePreset) {
  if (pattern === "none" || pattern === "custom") return "";
  if (!previews.has(pattern))
    previews.set(pattern, patternCanvas(pattern).toDataURL("image/png"));
  return previews.get(pattern)!;
}
export async function readTextureFile(
  file: File,
): Promise<{ image: string; imageName: string }> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw Error("Choose a PNG, JPG or WebP image.");
  if (file.size > 5 * 1024 * 1024)
    throw Error("Choose an image smaller than 5 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight)
      throw Error("This image could not be decoded.");
    const scale = Math.min(
      1,
      768 / Math.max(img.naturalWidth, img.naturalHeight),
    );
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const image = c.toDataURL("image/webp", 0.85);
    if (image.length > 1500000)
      throw Error("This image is too detailed. Try a smaller image.");
    return { image, imageName: file.name.slice(0, 200) };
  } catch (e) {
    throw new Error(
      e instanceof Error && e.message
        ? e.message
        : "Could not read this image.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
