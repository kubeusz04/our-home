import type { FurnitureKind } from "../model/types";
export function PlanSymbol({
  kind,
  x,
  y,
  width,
  height,
  color = "#b5b79b",
}: {
  kind: FurnitureKind;
  color?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}) {
  const common = { fill: color, stroke: "#665b49", strokeWidth: 2 };
  return (
    <svg
      viewBox="0 0 100 70"
      aria-hidden="true"
      x={x}
      y={y}
      width={width}
      height={height}
      style={{ pointerEvents: "none" }}
    >
      {kind === "sofa" ? (
        <g {...common}>
          <rect x="8" y="18" width="84" height="38" rx="9" />
          <rect x="16" y="8" width="68" height="20" rx="8" />
          <path d="M38 29v24m25-24v24" fill="none" />
          <rect x="5" y="25" width="13" height="30" rx="5" />
          <rect x="82" y="25" width="13" height="30" rx="5" />
          <path d="M18 57v5m64-5v5" />
        </g>
      ) : kind === "bed" ? (
        <g {...common}>
          <rect x="16" y="4" width="68" height="62" rx="5" />
          <rect x="20" y="9" width="26" height="17" rx="4" fill="#faf5e9" />
          <rect x="54" y="9" width="26" height="17" rx="4" fill="#faf5e9" />
          <path d="M18 30h64v29H18z" />
        </g>
      ) : kind.includes("freesia") || kind === "plant" ? (
        <g>
          <path
            d="M35 45h30l-5 22H40z"
            fill="#d8c6a4"
            stroke="#80765b"
            strokeWidth="2"
          />
          {[30, 45, 60, 72].map((x, i) => (
            <g key={x}>
              <path
                d={`M50 49Q${x} 25 ${x} ${9 + i * 3}`}
                fill="none"
                stroke="#70844e"
                strokeWidth="3"
              />
              {[0, 1, 2, 3, 4].map((n) => (
                <ellipse
                  key={n}
                  cx={x + Math.cos(n * 1.25) * 6}
                  cy={12 + i * 3 + Math.sin(n * 1.25) * 5}
                  rx="5"
                  ry={kind === "plant" ? 10 : 4}
                  fill={color}
                />
              ))}
            </g>
          ))}
        </g>
      ) : kind === "chair" ? (
        <g {...common}>
          <rect x="25" y="10" width="50" height="19" rx="5" />
          <rect x="22" y="33" width="56" height="21" rx="5" />
          <path d="M28 51v14m44-14v14M30 29v5m40-5v5" />
        </g>
      ) : kind === "lamp" || kind === "vase" ? (
        <g {...common}>
          <path d="M48 28h4v35h18v3H30v-3h18z" />
          <ellipse cx="50" cy="25" rx="25" ry="22" />
        </g>
      ) : kind === "table" || kind === "rug" ? (
        <g {...common}>
          <ellipse cx="50" cy="30" rx="41" ry="23" />
          {kind === "table" && <path d="M25 49v15m50-15v15M50 54v12" />}
        </g>
      ) : kind === "projector" ? (
        <g {...common}>
          <rect x="17" y="20" width="66" height="31" rx="7" />
          <circle cx="65" cy="35" r="10" fill="#333f3c" />
          <path d="M26 30h20m-20 8h20" />
        </g>
      ) : (
        <g {...common}>
          <rect x="18" y="7" width="64" height="52" rx="4" />
          <path d="M20 33h60M50 9v48M25 60v6m50-6v6" fill="none" />
        </g>
      )}
    </svg>
  );
}
