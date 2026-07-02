// src/components/ResultBall.tsx
// Uses /assets/svg/ball_0.png … ball_9.png
// PNG images already contain the number — no text rendered on top.
//
// Color mapping:
//   0 → Violet+Red (Small)   1 → Green (Small)   2 → Red (Small)
//   3 → Green (Small)         4 → Red  (Small)
//   5 → Violet+Green (Big)   6 → Red  (Big)       7 → Green (Big)
//   8 → Red  (Big)            9 → Green (Big)

interface ResultBallProps {
  number: number;
  size?: "sm" | "md" | "lg";
}

const PX = { sm: 20, md: 28, lg: 40 } as const;

// ── ResultBall: PNG asset, no number overlay ──────────────────────
export function ResultBall({ number, size = "md" }: ResultBallProps) {
  const px = PX[size];
  return (
    <img
      src={`/assets/svg/ball_${number}.png`}
      alt={String(number)}
      width={px}
      height={px}
      draggable={false}
      className="shrink-0 select-none object-contain"
      style={{ width: px, height: px }}
    />
  );
}

// ── ColorDot: color-only representation for the history Color column ─
// Shows a split circle for violet (0/5), solid dot for others.
// No number is rendered.
interface ColorDotProps {
  color: "red" | "green" | "violet";
  number: number; // needed to pick correct violet split
  sizePx?: number;
}

const COLOR_SOLID: Record<string, string> = {
  red:   "#ff4757",
  green: "#2ed573",
};

// 0 → violet+red, 5 → violet+green
const VIOLET_SPLIT: Record<number, [string, string]> = {
  0: ["#9c27b0", "#ff4757"],
  5: ["#9c27b0", "#2ed573"],
};

export function ColorDot({ color, number, sizePx = 16 }: ColorDotProps) {
  const r = sizePx / 2;

  if (color === "violet") {
    const [left, right] = VIOLET_SPLIT[number] ?? ["#9c27b0", "#9c27b0"];
    return (
      <svg
        width={sizePx}
        height={sizePx}
        viewBox={`0 0 ${sizePx} ${sizePx}`}
        className="shrink-0"
        style={{ borderRadius: "50%", overflow: "hidden" }}
      >
        <defs>
          <clipPath id={`cdl-${number}-${sizePx}`}>
            <rect x="0" y="0" width={r} height={sizePx} />
          </clipPath>
          <clipPath id={`cdr-${number}-${sizePx}`}>
            <rect x={r} y="0" width={r} height={sizePx} />
          </clipPath>
        </defs>
        <circle cx={r} cy={r} r={r} fill={left}  clipPath={`url(#cdl-${number}-${sizePx})`} />
        <circle cx={r} cy={r} r={r} fill={right} clipPath={`url(#cdr-${number}-${sizePx})`} />
        <circle cx={r} cy={r} r={r - 0.5} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      </svg>
    );
  }

  return (
    <div
      className="shrink-0 rounded-full"
      style={{
        width:  sizePx,
        height: sizePx,
        background: COLOR_SOLID[color] ?? "#6b7280",
        boxShadow: `0 0 4px ${COLOR_SOLID[color] ?? "#6b7280"}80`,
      }}
    />
  );
}
