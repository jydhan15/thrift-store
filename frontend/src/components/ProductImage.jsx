import { useEffect, useState } from "react";

// A real photo when the item has one; otherwise a clean illustration derived from
// the item's name/description. All product imagery goes through this component.
const COLORS = {
  Navy: "#1f3a5f", Olive: "#6b7a3a", Cream: "#efe6d0", Black: "#262626", Burgundy: "#6d1f2e",
  Mustard: "#d6a529", Sage: "#9caf88", Rust: "#b5532a", Charcoal: "#3a3f44", "Sky Blue": "#7fb7e0",
  Beige: "#d8c3a5", "Forest Green": "#2f5d4b", "Dusty Pink": "#d9a5a8", "Washed Denim": "#6f8fb0",
  Chocolate: "#5b3a29", Ivory: "#f4efe0",
};
const FALLBACK = Object.values(COLORS);
const SHAPES = {
  shirt: "M30 16 L42 10 Q50 20 58 10 L70 16 L92 34 L81 47 L71 41 L71 90 L29 90 L29 41 L19 47 L8 34 Z",
  jacket: "M28 14 L42 8 L50 20 L58 8 L72 14 L94 36 L83 50 L72 44 L72 92 L28 92 L28 44 L17 50 L6 36 Z",
  pants: "M30 10 H70 L74 92 H54 L50 44 L46 92 H26 Z",
  shorts: "M30 18 H70 L76 62 H54 L50 40 L46 62 H24 Z",
  dress: "M38 10 H62 L60 34 L80 92 H20 L40 34 Z",
  skirt: "M32 24 H68 L86 86 H14 Z",
  shoe: "M10 58 Q10 42 26 42 L38 42 Q44 54 62 56 L86 60 Q94 62 94 72 V80 H10 Z",
  cap: "M20 62 Q20 30 52 30 Q82 30 82 62 Z",
  bag: "M22 36 H78 L84 90 H16 Z",
  scarf: "M26 12 H74 V30 H62 V90 H44 V30 H26 Z",
};
const DETAILS = {
  shirt: [["M42 10 Q50 24 58 10"]],
  jacket: [["M50 20 V92"], ["M34 70 H44"], ["M56 70 H66"]],
  pants: [["M30 18 H70"], ["M50 18 V44"]],
  shorts: [["M30 24 H70"]],
  dress: [["M40 34 H60"]],
  skirt: [["M44 24 L40 86"], ["M56 24 L60 86"]],
  shoe: [["M10 74 H94"], ["M30 47 L36 53"], ["M37 45 L43 51"]],
  cap: [["M14 62 H90 Q92 72 82 72 H22 Q12 72 14 62 Z", true]],
  bag: [["M36 36 Q36 14 50 14 Q64 14 64 36"]],
  scarf: [["M26 20 H74"], ["M44 52 H62"], ["M44 72 H62"]],
};

export const kindOf = (name = "") => {
  const n = name.toLowerCase();
  if (/jacket|coat|hoodie|windbreaker/.test(n)) return "jacket";
  if (/dress/.test(n)) return "dress";
  if (/skirt/.test(n)) return "skirt";
  if (/sunglass/.test(n)) return "glasses";
  if (/shoe|boot|loafer|sneaker|force/.test(n)) return "shoe";
  if (/short/.test(n)) return "shorts";
  if (/jean|pant|corduroy|sweatpant/.test(n)) return "pants";
  if (/\b(hat|cap)\b/.test(n)) return "cap";
  if (/\b(bag|tote|belt)\b/.test(n)) return "bag";
  if (/scarf/.test(n)) return "scarf";
  return "shirt";
};

const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
export const colorOf = (item = {}) => {
  const match = /Color:\s*(.+)/i.exec(item.description || "");
  const named = (match && COLORS[match[1].trim()]) || Object.keys(COLORS).find((c) => (item.name || "").toLowerCase().includes(c.toLowerCase()));
  return (named && COLORS[named]) || FALLBACK[hash(item.name || "") % FALLBACK.length];
};
export const mix = (hex, to, r) => {
  const part = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = part(hex), b = part(to);
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * r).toString(16).padStart(2, "0")).join("");
};

export function Art({ kind, color, name }) {
  const k = kind || kindOf(name || "");
  const c = color || colorOf({ name });
  const dark = mix(c, "#000000", 0.3);
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <ellipse cx="50" cy="95" rx="30" ry="3" fill="rgba(0,0,0,.08)" />
      {k === "glasses" ? (
        <g stroke={dark} strokeWidth="1.5" strokeLinejoin="round">
          <rect x="10" y="38" width="35" height="26" rx="11" fill={c} />
          <rect x="55" y="38" width="35" height="26" rx="11" fill={c} />
          <path d="M45 47 H55 M10 44 L4 40 M90 44 L96 40" fill="none" />
        </g>
      ) : (
        <g stroke={dark} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
          <path d={SHAPES[k] || SHAPES.shirt} fill={c} />
          {(DETAILS[k] || []).map(([d, fill], i) => <path key={i} d={d} fill={fill ? dark : "none"} />)}
          {k === "cap" && <circle cx="52" cy="31" r="2.5" fill={dark} />}
        </g>
      )}
    </svg>
  );
}

export default function ProductImage({ p, name, imageUrl, description, big, className = "" }) {
  const item = p || { name, imageUrl, description };
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [item.imageUrl]);

  const color = colorOf(item);
  return (
    <div
      className={"thumb pimg" + (big ? " big" : "") + (className ? " " + className : "")}
      style={{ background: "linear-gradient(160deg," + mix(color, "#ffffff", 0.82) + ",#f7f3ec)" }}
    >
      {item.imageUrl && !broken ? (
        <img src={item.imageUrl} alt={item.name || "Product photo"} loading="lazy" decoding="async" onError={() => setBroken(true)} />
      ) : (
        <Art kind={kindOf(item.name || "")} color={color} />
      )}
    </div>
  );
}
