import { useEffect, useState } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { api, peso } from "../api.js";
import { useAuth } from "../App.jsx";

const ICON = { Shirts: "👕", Pants: "👖", Jackets: "🧥", "Dresses & Skirts": "👗", Shoes: "👟", Accessories: "🕶️" };
const THUMBS = [["jacket|coat|hoodie|windbreaker", "🧥", "#dfe9e2"], ["dress|skirt", "👗", "#f6e3e8"], ["shoe|boot|loafer|sneaker|force", "👟", "#f4ebd9"], ["jean|pant|short|corduroy", "👖", "#e3e8f4"], ["tee|shirt|blouse|flannel|sweater|knit", "👕", "#ece4f4"], ["hat|cap|scarf|belt|sunglass|tote", "🕶️", "#fbe8d9"]];
export const thumb = (name) => { const n = (name || "").toLowerCase(); const t = THUMBS.find((x) => new RegExp(x[0]).test(n)); return t ? { e: t[1], bg: t[2] } : { e: "🏷️", bg: "#ebe6da" }; };
const COND = { like_new: "Like new: almost no signs of wear", good: "Good: light wear, fully clean and intact", fair: "Fair: visible wear, priced down", worn: "Worn: well loved, small flaws noted" };

function Details({ text }) {
  return (<div className="details">{(text || "No description yet.").split("\n").map((line, i) => { const j = line.indexOf(": ");
    return j > 0 && j < 16 ? <div className="drow" key={i}><b>{line.slice(0, j)}</b><span>{line.slice(j + 2)}</span></div> : <p key={i}>{line}</p>; })}</div>);
}

export default function Shop() {
  const [sp, setSp] = useSearchParams();
  const category = sp.get("category") || "", brand = sp.get("brand") || "", q = sp.get("q") || "", condition = sp.get("condition") || "", sort = sp.get("sort") || "newest", page = parseInt(sp.get("page")) || 1;
  const set = (patch) => { const n = new URLSearchParams(sp); Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); if (!("page" in patch)) n.delete("page"); setSp(n); };
  const [cats, setCats] = useState([]); const [brands, setBrands] = useState([]); const [items, setItems] = useState([]); const [meta, setMeta] = useState({});
  const [ai, setAi] = useState(""); const [aiOut, setAiOut] = useState(null); const [aiErr, setAiErr] = useState(""); const [products, setProducts] = useState({}); const { user } = useAuth();

  useEffect(() => { api("/categories").then((r) => setCats(r.data)); }, []);
  useEffect(() => { api("/brands" + (category ? "?category=" + category : "")).then((r) => setBrands(r.data)); }, [category]);
  useEffect(() => {
    const p = new URLSearchParams({ page, limit: 12, sort }); if (q) p.set("q", q); if (condition) p.set("condition", condition); if (category) p.set("category", category); if (brand) p.set("brand", brand);
    api("/products?" + p).then((r) => { setItems(r.data); setMeta(r.meta); });
  }, [category, brand, q, condition, sort, page]);

  const ask = async () => { setAiErr(""); setAiOut(null);
    try { const r = await api("/ai/assistant", { method: "POST", body: { text: ai } }); const map = {};
      for (const x of r.data.results) { try { map[x.productId] = (await api("/products/" + x.productId)).data; } catch {} }
      setProducts(map); setAiOut(r.data); } catch (e) { setAiErr(e.message); } };

  const catName = (cats.find((c) => c._id === category) || {}).name || "";
  const total = cats.reduce((s, c) => s + c.count, 0);
  return (<div>
    <div className="hero"><h1>One-of-a-kind finds.</h1><p>Pre-loved fashion from brands you love. Every piece is unique, so when it is gone, it is gone.</p></div>
    <div className="ai"><b>✨ AI shopping assistant</b>{!user && <span> (login to use)</span>}
      <div className="row"><input style={{ flex: 1, minWidth: 200 }} placeholder="e.g. warm jacket under 1000 pesos" value={ai} onChange={(e) => setAi(e.target.value)} /><button disabled={!user || ai.length < 3} onClick={ask}>Ask</button></div>
      {aiErr && <div className="err">{aiErr}</div>}
      {aiOut && <div><small>{aiOut.aiAssisted ? "AI-assisted suggestions" : "Keyword results (AI unavailable)"}</small>
        {aiOut.results.map((x) => products[x.productId] && <div key={x.productId}><Link to={"/products/" + x.productId}>{products[x.productId].name}</Link> — {peso(products[x.productId].price)} <small>{x.reason}</small></div>)}</div>}</div>

    <h2>Shop by category</h2>
    <div className="cats">
      <button className={"cat" + (!category ? " on" : "")} onClick={() => set({ category: "", brand: "" })}><span className="ci">🛍️</span><b>All</b><small>{total} items</small></button>
      {cats.map((c) => <button key={c._id} className={"cat" + (category === c._id ? " on" : "")} onClick={() => set({ category: c._id, brand: "" })}><span className="ci">{ICON[c.name] || "🏷️"}</span><b>{c.name}</b><small>{c.count} items</small></button>)}
    </div>

    <h3>{category ? "Brands in " + catName : "Shop by brand"}</h3>
    <div className="chips">
      <button className={"chip" + (!brand ? " on" : "")} onClick={() => set({ brand: "" })}>All brands</button>
      {brands.map((b) => <button key={b.name} className={"chip" + (brand === b.name ? " on" : "")} onClick={() => set({ brand: b.name })}>{b.name}<span className="n">{b.count}</span></button>)}
    </div>

    <div className="row"><input placeholder="Search…" value={q} onChange={(e) => set({ q: e.target.value })} />
      <select value={condition} onChange={(e) => set({ condition: e.target.value })}><option value="">Any condition</option><option value="like_new">Like new</option><option value="good">Good</option><option value="fair">Fair</option><option value="worn">Worn</option></select>
      <select value={sort} onChange={(e) => set({ sort: e.target.value === "newest" ? "" : e.target.value })}><option value="newest">Newest</option><option value="price_asc">Price ↑</option><option value="price_desc">Price ↓</option></select></div>
    <h3 style={{ marginTop: 18 }}>{[catName, brand].filter(Boolean).join(" · ") || "New arrivals"} <small>({meta.total || 0} items)</small></h3>
    {!items.length && <p>No items match. Try another brand or category.</p>}
    <div className="grid">{items.map((p) => { const t = thumb(p.name); return (<Link to={"/products/" + p._id} className="card pcard" key={p._id} style={{ position: "relative" }}>
      <div className="thumb" style={{ background: t.bg }}>{t.e}</div>{p.stock < 1 && <span className="sold">Sold</span>}
      <div className="pbody">{p.brand && <span className="brandlbl">{p.brand}</span>}<b>{p.name}</b><p className="desc">{(p.description || "").split("\n")[0]}</p>
        <div><span className={"tag " + p.condition}>{p.condition.replace("_", " ")}</span><span className="tag">Size {p.size}</span></div><div className="price" style={{ marginTop: 8 }}>{peso(p.price)}</div></div></Link>); })}</div>
    <div className="row" style={{ marginTop: 18 }}><button disabled={page <= 1} onClick={() => set({ page: String(page - 1) })}>Prev</button><span>Page {page} / {Math.max(1, Math.ceil((meta.total || 0) / 12))}</span><button disabled={page * 12 >= (meta.total || 0)} onClick={() => set({ page: String(page + 1) })}>Next</button></div></div>);
}

export function Product() {
  const { id } = useParams(); const [p, setP] = useState(null); const [msg, setMsg] = useState(null); const [offer, setOffer] = useState(""); const { user } = useAuth(); const nav = useNavigate();
  useEffect(() => { api("/products/" + id).then((r) => setP(r.data)).catch((e) => setMsg({ err: e.message })); }, [id]);
  const run = async (fn, ok) => { setMsg(null); try { await fn(); setMsg({ ok }); } catch (e) { setMsg({ err: e.message }); } };
  if (!p) return <div>{msg?.err || "Loading…"}</div>;
  const t = thumb(p.name);
  return (<div className="card"><button className="alt" onClick={() => nav(-1)}>← Back</button>
    <div className="thumb big" style={{ background: t.bg, marginTop: 14 }}>{t.e}</div>
    {p.brand && <span className="brandlbl">{p.brand}</span>}<h2>{p.name}</h2>
    <div><span className={"tag " + p.condition}>{p.condition.replace("_", " ")}</span> <span className="tag">Size {p.size}</span></div><small>{COND[p.condition]}</small>
    <h3 className="price" style={{ marginTop: 10 }}>{peso(p.price)}</h3>
    <Details text={p.description} />
    {msg?.err && <div className="err">{msg.err}</div>}{msg?.ok && <div className="ok">{msg.ok}</div>}
    {p.stock < 1 ? <b>Sold / reserved</b> : !user ? <button onClick={() => nav("/login")}>Login to buy</button> : <>
      <button onClick={() => run(() => api("/cart/items", { method: "POST", body: { productId: p._id, qty: 1 } }), "Added to cart")}>Add to cart</button>
      <h4>Make an offer (₱)</h4><div className="row"><input type="number" placeholder="Your price" value={offer} onChange={(e) => setOffer(e.target.value)} />
        <button className="alt" onClick={() => run(() => api("/products/" + p._id + "/offers", { method: "POST", body: { amount: Math.round(+offer * 100) } }), "Offer sent. Check status in Orders > My offers.")}>Send offer</button></div></>}</div>);
}
