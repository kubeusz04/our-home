import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, ImageOff } from "lucide-react";
import type { Material, SurfaceStyle, TexturePreset } from "../model/types";
import { palette } from "../model/seed";
import {
  defaultSurface,
  effectiveTexture,
  materialNames,
  texturePresets,
} from "../model/surfaces";
import { patternPreview, readTextureFile } from "../model/texturePatterns";
import { useStore } from "../model/store";
import { NumberField } from "./Fields";
export default function AppearanceEditor({
  value,
  onChange,
}: {
  value: SurfaceStyle;
  onChange: (surface: SurfaceStyle) => void;
}) {
  const input = useRef<HTMLInputElement>(null),
    alive = useRef(true),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const pattern = effectiveTexture(value),
    preview = useMemo(
      () =>
        pattern === "custom" ? (value.image ?? "") : patternPreview(pattern),
      [pattern, value.image],
    );
  const change = (patch: Partial<SurfaceStyle>) =>
    onChange({ ...value, ...patch });
  return (
    <div className="appearance-editor" data-testid="surface-editor">
      <div
        className="surface-preview"
        style={{ backgroundColor: value.color }}
        aria-label="Surface preview"
      >
        <div
          style={{
            backgroundImage: preview ? `url("${preview}")` : undefined,
            backgroundSize: `${100 / value.repeat}% ${100 / value.repeat}%`,
            transform: `rotate(${value.rotation}deg)`,
          }}
        />
        <span>{texturePresets.find((p) => p.id === value.texture)?.name}</span>
      </div>
      <div className="swatches">
        {palette.map(([name, color]) => (
          <button
            type="button"
            key={name}
            title={name}
            aria-label={name}
            className={value.color === color ? "selected" : ""}
            style={{ background: color }}
            onClick={() => change({ color })}
          />
        ))}
      </div>
      <label className="field">
        <span>Colour</span>
        <div className="color-input">
          <input
            aria-label="HEX colour"
            type="color"
            value={value.color}
            onChange={(e) => change({ color: e.target.value })}
          />
          <input
            className="hex-value"
            key={value.color}
            aria-label="HEX value"
            defaultValue={value.color.toUpperCase()}
            maxLength={7}
            onBlur={(e) => {
              const c = e.target.value.trim();
              if (/^#[\da-f]{6}$/i.test(c)) change({ color: c });
              else e.target.value = value.color.toUpperCase();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
        </div>
      </label>
      <label className="appearance-label">
        Material
        <select
          aria-label="Material"
          value={value.material}
          onChange={(e) =>
            change({
              material: e.target.value as Material,
              roughness: defaultSurface(value.color, e.target.value as Material)
                .roughness,
            })
          }
        >
          {materialNames.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <label className="appearance-label">
        Texture
        <select
          aria-label="Texture pattern"
          value={value.texture}
          onChange={(e) => {
            const texture = e.target.value as TexturePreset;
            if (texture === "custom" && !value.image) {
              input.current?.click();
              return;
            }
            change({ texture });
          }}
        >
          {texturePresets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <div className="texture-actions">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          <Upload size={15} />
          {busy ? "Preparing image…" : "Upload texture"}
        </button>
        <button
          type="button"
          title="Remove texture"
          aria-label="Remove texture"
          onClick={() =>
            change({ texture: "none", image: undefined, imageName: undefined })
          }
        >
          <ImageOff size={15} />
        </button>
      </div>
      <input
        ref={input}
        className="texture-file-input"
        tabIndex={-1}
        aria-label="Texture image"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          try {
            const asset = await readTextureFile(file);
            if (alive.current)
              onChange({ ...value, ...asset, texture: "custom" });
          } catch (error) {
            useStore
              .getState()
              .notify(
                error instanceof Error
                  ? error.message
                  : "Could not load this texture.",
              );
          } finally {
            if (alive.current) {
              setBusy(false);
              if (input.current) input.current.value = "";
            }
          }
        }}
      />
      {value.imageName && value.texture === "custom" && (
        <div className="texture-filename">
          <span>{value.imageName}</span>
          <button
            className="text-button"
            onClick={() => change({ color: "#ffffff" })}
          >
            Use image colours
          </button>
        </div>
      )}
      <NumberField
        label="Texture repeat"
        value={value.repeat}
        min={0.25}
        max={20}
        step={0.25}
        unit="×"
        onChange={(repeat) => change({ repeat })}
      />
      <NumberField
        label="Texture rotation"
        value={value.rotation}
        min={-360}
        max={360}
        step={15}
        unit="°"
        onChange={(rotation) => change({ rotation })}
      />
      <label className="appearance-label roughness-field">
        <span>
          Roughness <small>{value.roughness.toFixed(2)}</small>
        </span>
        <input
          aria-label="Roughness"
          type="range"
          min="0"
          max="1"
          step=".05"
          value={value.roughness}
          onChange={(e) => change({ roughness: Number(e.target.value) })}
        />
      </label>
      <p className="texture-help">
        PNG, JPG or WebP · up to 5 MB. Images are resized and stored in this
        project. Colour tints the pattern.
      </p>
    </div>
  );
}
