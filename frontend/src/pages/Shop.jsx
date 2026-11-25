import { useEffect, useState } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { api, peso } from "../api.js";
import { useAuth } from "../App.jsx";
import ProductImage, { Art } from "../components/ProductImage.jsx";

const CAT_ART = {
  Shirts: ["shirt", "#6f8fb0"], Pants: ["pants", "#1f3a5f"], Jackets: ["jacket", "#6b7a3a"],
  "Dresses & Skirts": ["dress", "#d9a5a8"], Shoes: ["shoe", "#b5532a"], Accessories: ["cap", "#d6a529"],
};
const HERO_FINDS = [
  ["jacket", "#6f8fb0", 65000],
  ["dress", "#d9a5a8", 42000],
  ["shoe", "#b5532a", 89000],
];
const COND = {
  like_new: "Like new: almost no signs of wear",
  good: "Good: light wear, fully clean and intact",
  fair: "Fair: visible wear, priced down",
  worn: "Worn: well loved, small flaws noted",
};

function Details({ text }) {
  return (
    <div className="details">
      {(text || "No description yet.").split("\n").map((line, i) => {
        const j = line.indexOf(": ");
        return j > 0 && j < 16
          ? <div className="drow" key={i}><b>{line.slice(0, j)}</b><span>{line.slice(j + 2)}</span></div>
          : <p key={i}>{line}</p>;
      })}
    </div>
  );
}

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
  </svg>
);

export default function Shop() {
  const [sp, setSp] = useSearchParams();
  const category = sp.get("category") || "", brand = sp.get("brand") || "", q = sp.get("q") || "";
  const condition = sp.get("condition") || "", sort = sp.get("sort") || "newest", page = parseInt(sp.get("page")) || 1;
  // Functional update so a pending debounced search can't overwrite a filter the user just tapped.
  const set = (patch) => setSp((prev) => {
    const n = new URLSearchParams(prev);
    Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    if (!("page" in patch)) n.delete("page");
    return n;
  });

  const [term, setTerm] = useState(q);
  const [cats, setCats] = useState([]);
  const [brands, setBrands] = useState([]);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [ai, setAi] = useState("");
  const [aiOut, setAiOut] = useState(null);
  const [aiErr, setAiErr] = useState("");
  const [products, setProducts] = useState({});
  const { user } = useAuth();

  // Debounce typing so we don't hit the API on every keystroke on a phone.
  useEffect(() => setTerm(q), [q]);
  useEffect(() => {
    if (term === q) return;
    const t = setTimeout(() => set({ q: term }), 300);
    return () => clearTimeout(t);
  }, [term, q]);

  useEffect(() => { api("/categories").then((r) => setCats(r.data)).catch(() => {}); }, []);
  useEffect(() => { api("/brands" + (category ? "?category=" + encodeURIComponent(category) : "")).then((r) => setBrands(r.data)).catch(() => {}); }, [category]);
  useEffect(() => {
    const p = new URLSearchParams({ page, limit: 12, sort });
    if (q) p.set("q", q);
    if (condition) p.set("condition", condition);
    if (category) p.set("category", category);
    if (brand) p.set("brand", brand);
    setLoading(true);
    api("/products?" + p).then((r) => { setItems(r.data); setMeta(r.meta); }).catch(() => { setItems([]); }).finally(() => setLoading(false));
  }, [category, brand, q, condition, sort, page]);

  const ask = async () => {
    setAiErr(""); setAiOut(null);
    try {
      const r = await api("/ai/assistant", { method: "POST", body: { text: ai } });
      const map = {};
      await Promise.all(r.data.results.map(async (x) => {
        try { map[x.productId] = (await api("/products/" + x.productId)).data; } catch { /* skip unavailable item */ }
      }));
      setProducts(map);
      setAiOut(r.data);
    } catch (e) { setAiErr(e.message); }
  };

  const catName = (cats.find((c) => c._id === category) || {}).name || "";
  const total = cats.reduce((s, c) => s + c.count, 0);
  const pages = Math.max(1, Math.ceil((meta.total || 0) / 12));

  return (
    <div className="shop">
      <div className="searchbar">
        <SearchIcon />
        <input type="search" aria-label="Search products" placeholder="Search brands, items, styles" value={term} onChange={(e) => setTerm(e.target.value)} enterKeyHint="search" />
      </div>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Secondhand, first choice</span>
          <h1>One-of-a-kind finds.</h1>
          <p>Pre-loved fashion from brands you love. When it is gone, it is gone.</p>
          <button className="hero-cta" onClick={() => document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" })}>Start browsing</button>
        </div>
        <div className="hero-art" aria-hidden="true">
          {HERO_FINDS.map(([kind, color, price]) => (
            <div className="art-tile" key={kind}>
              <div className="thumb"><Art kind={kind} color={color} /></div>
              <span className="tag">{peso(price)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="ai" aria-label="AI shopping assistant">
        <b>✨ AI shopping assistant</b>{!user && <small> — log in to use it</small>}
        <div className="row">
          <input aria-label="Describe what you want" placeholder="e.g. warm jacket under 1000 pesos" value={ai} onChange={(e) => setAi(e.target.value)} enterKeyHint="search" />
          <button className="accent" disabled={!user || ai.trim().length < 3} onClick={ask}>Ask</button>
        </div>
        {aiErr && <div className="err" role="alert">{aiErr}</div>}
        {aiOut && (
          <div className="ai-out">
            <small>{aiOut.aiAssisted ? "AI-assisted suggestions" : "Keyword results (AI unavailable)"}</small>
            {aiOut.results.map((x) => {
              const p = products[x.productId];
              return p && (
                <Link className="ai-row" to={"/products/" + x.productId} key={x.productId}>
                  <ProductImage p={p} />
                  <span className="ai-copy"><b>{p.name}</b><small>{x.reason}</small></span>
                  <span className="price">{peso(p.price)}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section id="shop">
        <div className="sec-h"><h3>Shop by category</h3></div>
        <div className="cats2">
          <button className={"cat2" + (!category ? " on" : "")} onClick={() => set({ category: "", brand: "" })}>
            <span className="circle"><Art kind="bag" color="#2f5d4b" /></span><small>All · {total}</small>
          </button>
          {cats.map((c) => {
            const [kind, color] = CAT_ART[c.name] || ["shirt", "#6f8fb0"];
            return (
              <button key={c._id} className={"cat2" + (category === c._id ? " on" : "")} onClick={() => set({ category: c._id, brand: "" })}>
                <span className="circle"><Art kind={kind} color={color} /></span><small>{c.name} · {c.count}</small>
              </button>
            );
          })}
        </div>

        <div className="sec-h"><h3>{category ? "Brands in " + catName : "Shop by brand"}</h3></div>
        <div className="chips">
          <button className={"chip" + (!brand ? " on" : "")} onClick={() => set({ brand: "" })}>All brands</button>
          {brands.map((b) => (
            <button key={b.name} className={"chip" + (brand === b.name ? " on" : "")} onClick={() => set({ brand: b.name })}>
              {b.name}<span className="n">{b.count}</span>
            </button>
          ))}
        </div>

        <div className="sec-h">
          <h3>{[catName, brand].filter(Boolean).join(" · ") || "New arrivals"}</h3>
          <button className="btn ghost sm filter-toggle" aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}>Filters</button>
          <small>{meta.total || 0} items</small>
        </div>
        <div className={"row filters" + (showFilters ? " open" : "")}>
          <select aria-label="Condition" value={condition} onChange={(e) => set({ condition: e.target.value })}>
            <option value="">Any condition</option><option value="like_new">Like new</option><option value="good">Good</option><option value="fair">Fair</option><option value="worn">Worn</option>
          </select>
          <select aria-label="Sort" value={sort} onChange={(e) => set({ sort: e.target.value === "newest" ? "" : e.target.value })}>
            <option value="newest">Newest</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option>
          </select>
        </div>

        {loading && !items.length && (
          <div className="grid">{[1, 2, 3, 4].map((i) => <div className="card skel" key={i} />)}</div>
        )}
        {!loading && !items.length && (
          <div className="empty">
            <span className="empty-art"><SearchIcon /></span>
            <h3>No matches</h3>
            <p>Try another category or brand, or clear your filters.</p>
            <button onClick={() => setSp({})}>Clear filters</button>
          </div>
        )}
        <div className={"grid" + (loading && items.length ? " dim" : "")}>
          {items.map((p) => (
            <Link to={"/products/" + p._id} className="card pcard" key={p._id}>
              <div className="imgwrap">
                <ProductImage p={p} />
                <span className={"tag cond " + p.condition}>{p.condition.replace("_", " ")}</span>
                {p.stock < 1 && <span className="sold">Sold</span>}
              </div>
              <div className="pbody">
                {p.brand && <span className="brandlbl">{p.brand}</span>}
                <b>{p.name}</b>
                <p className="desc">{p.description || ""}</p>
                <div className="pfoot"><span className="price">{peso(p.price)}</span><span className="tag">Size {p.size}</span></div>
              </div>
            </Link>
          ))}
        </div>

        {pages > 1 && (
          <div className="pager">
            <button disabled={page <= 1} onClick={() => set({ page: String(page - 1) })}>‹ Prev</button>
            <span>Page {page} / {pages}</span>
            <button disabled={page >= pages} onClick={() => set({ page: String(page + 1) })}>Next ›</button>
          </div>
        )}
      </section>
    </div>
  );
}

export function Product() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [msg, setMsg] = useState(null);
  const [offer, setOffer] = useState("");
  const [busy, setBusy] = useState(false);
  const { user, refreshCart } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    api("/products/" + id).then((r) => setP(r.data)).catch((e) => setMsg({ err: e.message }));
  }, [id]);

  const run = async (fn, ok) => {
    setMsg(null); setBusy(true);
    try { await fn(); setMsg({ ok }); } catch (e) { setMsg({ err: e.message }); } finally { setBusy(false); }
  };
  if (!p) return <div className="empty">{msg?.err || "Loading…"}</div>;

  const add = () => run(async () => {
    await api("/cart/items", { method: "POST", body: { productId: p._id, qty: 1 } });
    await refreshCart();
  }, "Added to cart");

  return (
    <div className="pdp">
      <div className="pdp-img">
        <button className="back" onClick={() => nav(-1)} aria-label="Go back">‹</button>
        <ProductImage p={p} big />
      </div>
      <div className="card pdp-body">
        {p.brand && <span className="brandlbl">{p.brand}</span>}
        <h2>{p.name}</h2>
        <div className="condition-row"><span className={"tag " + p.condition}>{p.condition.replace("_", " ")}</span><span className="tag">Size {p.size}</span></div>
        <small>{COND[p.condition]}</small>
        <div className="price xl">{peso(p.price)}</div>
        <Details text={p.description} />
        {msg?.err && <div className="err" role="alert">{msg.err}</div>}
        {msg?.ok && <div className="ok" role="status">{msg.ok}</div>}
        {p.stock < 1 ? (
          <div className="ok-inline" role="status">This piece has been sold or reserved.</div>
        ) : !user ? (
          <button className="wide accent" onClick={() => nav("/login")}>Log in to buy</button>
        ) : (
          <>
            <button className="desk-only accent" disabled={busy} onClick={add}>{busy ? "Adding…" : "Add to cart"}</button>
            <h4>Make an offer (₱)</h4>
            <div className="row">
              <input type="number" inputMode="decimal" min="1" placeholder="Your price" aria-label="Your offer in pesos" value={offer} onChange={(e) => setOffer(e.target.value)} />
              <button className="alt" disabled={busy || !( +offer > 0 )} onClick={() => run(() => api("/products/" + p._id + "/offers", { method: "POST", body: { amount: Math.round(+offer * 100) } }), "Offer sent. Check Orders › My offers.")}>Send offer</button>
            </div>
          </>
        )}
      </div>
      {p.stock > 0 && user && (
        <div className="stickybar">
          <div><small>Price</small><b>{peso(p.price)}</b></div>
          <button className="accent" disabled={busy} onClick={add}>{busy ? "Adding…" : "Add to cart"}</button>
        </div>
      )}
    </div>
  );
}
