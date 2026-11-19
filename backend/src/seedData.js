const COLORS = ["Navy","Olive","Cream","Black","Burgundy","Mustard","Sage","Rust","Charcoal","Sky Blue","Beige","Forest Green","Dusty Pink","Washed Denim","Chocolate","Ivory"];
const BRANDS = ["Carhartt","Stussy","Nike","Adidas","Supreme","Champion","Levis","Dickies","Uniqlo","Zara","H&M","Gap","Wrangler","Bench","Giordano","Cotton On","Mango","Penshoppe","Patagonia","The North Face","Puma","Vans","Converse","New Balance"];
const CLOTH = ["XS","S","M","L","XL"], WAIST = ["26","28","30","32","34"], SHOE = ["38","39","40","41","42","43"];
const CONDITIONS = [
  ["like_new", "Looks almost new. No stains, holes, or fading. Tags removed only."],
  ["good", "Light signs of normal wear. No stains or holes. Colors still rich."],
  ["good", "Gently used with soft fading from washing. Everything intact and clean."],
  ["fair", "Visible wear: slight fading and a few small pilling spots. No holes. Priced down for it."],
  ["worn", "Well loved. Noticeable fading and a small flaw (tiny mark near the hem). Great for casual or layering."],
];
const TYPES = [
  { n: "Denim Jacket", c: "Jackets", p: [650, 1200], s: CLOTH, fab: "Cotton denim", fit: "Relaxed fit", blurb: "Classic denim jacket with button front and two chest pockets. Easy to layer over tees and dresses.", m: (i) => "Chest " + (52 + i * 2) + " cm, length " + (60 + i) + " cm, sleeve " + (58 + i) + " cm (laid flat)" },
  { n: "Graphic Tee", c: "Shirts", p: [180, 420], s: CLOTH, fab: "Cotton jersey", fit: "Regular fit", blurb: "Soft vintage-style graphic tee with a broken-in feel. The print is intact with no cracking.", m: (i) => "Chest " + (48 + i * 2) + " cm, length " + (66 + i * 2) + " cm (laid flat)" },
  { n: "Flannel Shirt", c: "Shirts", p: [350, 650], s: CLOTH, fab: "Brushed cotton flannel", fit: "Regular fit", blurb: "Warm plaid flannel with a button front and chest pocket. Wear it buttoned or open as a light jacket.", m: (i) => "Chest " + (52 + i * 2) + " cm, length " + (70 + i) + " cm (laid flat)" },
  { n: "Knit Sweater", c: "Shirts", p: [450, 850], s: CLOTH, fab: "Acrylic-wool blend knit", fit: "Oversized", blurb: "Chunky knit sweater that is warm without being heavy. Great for cool evenings and air-conditioned offices.", m: (i) => "Chest " + (56 + i * 2) + " cm, length " + (62 + i) + " cm (laid flat)" },
  { n: "Silk Blouse", c: "Shirts", p: [400, 750], s: CLOTH, fab: "Satin-finish polyester", fit: "Relaxed fit", blurb: "Smooth, drapey blouse that works from office to dinner. Button front with a soft collar.", m: (i) => "Chest " + (48 + i * 2) + " cm, length " + (62 + i) + " cm (laid flat)" },
  { n: "Straight Jeans", c: "Pants", p: [700, 1400], s: WAIST, fab: "Cotton denim", fit: "Straight leg", blurb: "Sturdy straight-leg jeans with a button fly and five pockets. Gets better with every wash.", m: (i) => "Waist " + (68 + i * 4) + " cm, inseam 76 cm, rise 28 cm (laid flat)" },
  { n: "Cargo Pants", c: "Pants", p: [500, 950], s: WAIST, fab: "Cotton twill", fit: "Loose fit", blurb: "Roomy cargo pants with side pockets and an adjustable hem. Practical and very on trend.", m: (i) => "Waist " + (70 + i * 4) + " cm, inseam 78 cm (laid flat)" },
  { n: "Pleated Skirt", c: "Dresses & Skirts", p: [300, 650], s: CLOTH, fab: "Poly-cotton blend", fit: "A-line", blurb: "Flowy pleated skirt with an elastic back waist for an easy fit. Swishes nicely when you walk.", m: (i) => "Waist " + (64 + i * 4) + " cm, length " + (58 + i) + " cm (laid flat)" },
  { n: "Denim Shorts", c: "Pants", p: [250, 550], s: WAIST, fab: "Cotton denim", fit: "Mid-rise", blurb: "Cut-off style denim shorts with a clean frayed hem. Light and comfortable for hot days.", m: (i) => "Waist " + (68 + i * 4) + " cm, length 34 cm (laid flat)" },
  { n: "Floral Dress", c: "Dresses & Skirts", p: [450, 950], s: CLOTH, fab: "Lightweight rayon", fit: "Flowy", blurb: "Breezy midi dress with a floral print and a flattering waist. Light enough for the tropical heat.", m: (i) => "Bust " + (46 + i * 2) + " cm, length " + (105 + i * 2) + " cm (laid flat)" },
  { n: "Slip Dress", c: "Dresses & Skirts", p: [400, 800], s: CLOTH, fab: "Satin-finish polyester", fit: "Slim fit", blurb: "Minimal slip dress with thin adjustable straps. Dress it up with heels or down with a jacket.", m: (i) => "Bust " + (42 + i * 2) + " cm, length " + (100 + i * 2) + " cm (laid flat)" },
  { n: "Canvas Sneakers", c: "Shoes", p: [400, 900], s: SHOE, fab: "Canvas upper, rubber sole", fit: "True to size", blurb: "Everyday canvas sneakers with a cushioned insole. Laces are fresh and the soles are cleaned.", m: (i) => "Insole length " + (24 + i * 0.5) + " cm" },
  { n: "Leather Boots", c: "Shoes", p: [900, 1800], s: SHOE, fab: "Genuine leather, rubber sole", fit: "True to size", blurb: "Durable leather boots with plenty of life left. Conditioned and polished, ready to wear.", m: (i) => "Insole length " + (24 + i * 0.5) + " cm, shaft height 14 cm" },
  { n: "Leather Belt", c: "Accessories", p: [150, 380], s: ["One size"], fab: "Genuine leather, metal buckle", fit: "Adjustable", blurb: "Classic leather belt with a sturdy metal buckle. Five holes give a flexible fit.", m: () => "Length 105 cm, width 3.5 cm" },
  { n: "Bucket Hat", c: "Accessories", p: [120, 320], s: ["One size"], fab: "Cotton twill", fit: "Adjustable", blurb: "Soft bucket hat that folds flat and packs easily. Good sun protection for walks and trips.", m: () => "Circumference 58 cm, brim 6 cm" },
  { n: "Wool Scarf", c: "Accessories", p: [200, 480], s: ["One size"], fab: "Wool-blend knit", fit: "One size", blurb: "Thick, cozy scarf with fringed ends. Adds a warm pop of color to any outfit.", m: () => "Length 170 cm, width 28 cm" },
  { n: "Tote Bag", c: "Accessories", p: [250, 600], s: ["One size"], fab: "Canvas with cotton lining", fit: "One size", blurb: "Roomy tote with an inside pocket and sturdy handles. Fits a laptop, books, and lunch.", m: () => "Width 38 cm, height 34 cm, depth 12 cm" },
  { n: "Hoodie", c: "Jackets", p: [500, 1100], s: CLOTH, fab: "Cotton-fleece blend", fit: "Oversized", blurb: "Heavyweight hoodie with a kangaroo pocket and a soft fleece inside. Cozy for cold rooms and rainy days.", m: (i) => "Chest " + (56 + i * 2) + " cm, length " + (66 + i) + " cm (laid flat)" },
  { n: "Coach Jacket", c: "Jackets", p: [600, 1300], s: CLOTH, fab: "Nylon shell, light lining", fit: "Boxy fit", blurb: "Light snap-button coach jacket that blocks wind and drizzle. An easy streetwear layer.", m: (i) => "Chest " + (56 + i * 2) + " cm, length " + (68 + i) + " cm, sleeve " + (60 + i) + " cm (laid flat)" },
  { n: "Sweatpants", c: "Pants", p: [350, 800], s: CLOTH, fab: "Cotton-fleece blend", fit: "Relaxed fit", blurb: "Soft sweatpants with a drawstring waist and side pockets. Comfortable for lounging or errands.", m: (i) => "Waist " + (34 + i * 2) + " cm relaxed, inseam 74 cm (laid flat)" },
  { n: "Running Shoes", c: "Shoes", p: [700, 1600], s: SHOE, fab: "Mesh upper, foam midsole", fit: "True to size", blurb: "Lightweight running shoes with a cushioned midsole and good grip left on the outsole.", m: (i) => "Insole length " + (24 + i * 0.5) + " cm" },
  { n: "Baseball Cap", c: "Accessories", p: [150, 380], s: ["One size"], fab: "Cotton twill", fit: "Adjustable strap", blurb: "Curved-brim cap with an adjustable back strap. The sweatband is clean and the embroidery is intact.", m: () => "Circumference 54-61 cm adjustable, brim 7 cm" },
];
const POOLS = {
  Shirts: ["Carhartt","Stussy","Nike","Adidas","Champion","Supreme","Uniqlo","H&M","Zara","Gap","Bench","Penshoppe","Giordano","Cotton On","Mango"],
  Pants: ["Levis","Dickies","Carhartt","Wrangler","Nike","Adidas","Uniqlo","Zara","Gap","H&M","Stussy","Bench"],
  Jackets: ["Carhartt","Stussy","Nike","Adidas","The North Face","Patagonia","Champion","Levis","Supreme","Uniqlo"],
  "Dresses & Skirts": ["Zara","H&M","Mango","Uniqlo","Cotton On","Penshoppe","Giordano","Gap"],
  Shoes: ["Nike","Adidas","Vans","Converse","New Balance","Puma"],
  Accessories: ["Nike","Adidas","Carhartt","Stussy","Supreme","Champion","Levis","Uniqlo","Patagonia","The North Face"],
};
const CATEGORIES = ["Shirts", "Pants", "Jackets", "Dresses & Skirts", "Shoes", "Accessories"];
function categoryOf(name) {
  const n = String(name).toLowerCase();
  if (/jacket|coat|hoodie|windbreaker/.test(n)) return "Jackets";
  if (/dress|skirt/.test(n)) return "Dresses & Skirts";
  if (/shoe|boot|loafer|sneaker|force/.test(n)) return "Shoes";
  if (/jean|pant|short|corduroy|trouser/.test(n)) return "Pants";
  if (/\b(hat|cap|belt|bag|tote|scarf)\b|sunglass/.test(n)) return "Accessories";
  return "Shirts";
}
const rnd = (i, k) => Math.abs(Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1;
const roundTo = (v, step) => Math.round(v / step) * step;

function describe(t, brand, color, size, si, cond) {
  return [
    t.blurb,
    "Brand: " + brand,
    "Color: " + color,
    "Material: " + t.fab,
    "Size: " + size + " (" + t.fit + ")",
    "Measurements: " + t.m(si),
    "Condition: " + cond[1],
    "Washed and sanitized. Ready to wear. One of a kind: once sold, it is gone.",
  ].join("\n");
}
function buildItems(count = 120) {
  const out = [], seen = new Set();
  for (let i = 0; out.length < count && i < count * 8; i++) {
    const t = TYPES[i % TYPES.length], pool = POOLS[t.c];
    const brand = pool[Math.floor(rnd(i, 2) * pool.length)], color = COLORS[Math.floor(rnd(i, 1) * COLORS.length)];
    const name = brand + " " + color + " " + t.n;
    if (seen.has(name)) continue; seen.add(name);
    const si = Math.floor(rnd(i, 3) * t.s.length), cond = CONDITIONS[Math.floor(rnd(i, 4) * CONDITIONS.length)];
    const base = t.p[0] + rnd(i, 5) * (t.p[1] - t.p[0]);
    const factor = { like_new: 1, good: 0.85, fair: 0.65, worn: 0.5 }[cond[0]];
    out.push({ name, brand, category: t.c, price: Math.max(10000, roundTo(base * factor, 10) * 100), condition: cond[0], size: t.s[si], description: describe(t, brand, color, t.s[si], Math.min(si, 4), cond) });
  }
  return out;
}
module.exports = { buildItems, describe, categoryOf, CATEGORIES, TYPES, CONDITIONS, BRANDS, COLORS };
