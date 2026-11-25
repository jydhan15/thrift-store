import { useEffect, useState } from "react";
import { api, peso } from "../api.js";

const EMPTY_PRODUCT = { name: "", price: "", size: "", condition: "good", description: "", brand: "", category: "", imageUrl: "" };

export default function Admin() {
  const [dash, setDash] = useState(null);
  const [orders, setOrders] = useState([]);
  const [offers, setOffers] = useState([]);
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [msg, setMsg] = useState("");
  const [np, setNp] = useState(EMPTY_PRODUCT);
  const [cp, setCp] = useState({ code: "", type: "percent", value: "" });

  const load = () => {
    api("/admin/dashboard").then((r) => setDash(r.data)).catch(() => {});
    api("/admin/orders").then((r) => setOrders(r.data)).catch(() => {});
    api("/admin/offers").then((r) => setOffers(r.data)).catch(() => {});
    api("/products?limit=50").then((r) => setProducts(r.data)).catch(() => {});
    api("/categories").then((r) => setCats(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const go = async (fn) => {
    setMsg("");
    try { await fn(); load(); }
    catch (e) { setMsg(e.message + (e.details ? " " + JSON.stringify(e.details) : "")); }
  };
  const field = (k) => (e) => setNp({ ...np, [k]: e.target.value });
  const NEXT = { paid: "processing", processing: "shipped", shipped: "delivered" };

  return (
    <div>
      <div className="admin-head"><h1>Admin</h1><button className="btn ghost sm" onClick={load}>Refresh</button></div>
      {msg && <div className="err" role="alert">{msg}</div>}

      {dash && (
        <section className="section">
          <h3>Overview</h3>
          <div className="admin-stats">
            <div className="card"><small>Paid orders</small><div className="stat">{dash.paidOrders}</div></div>
            <div className="card"><small>Gross sales</small><div className="stat">{peso(dash.grossSales)}</div></div>
            <div className="card"><small>Pending</small><div className="stat">{dash.pendingOrders}</div></div>
            <div className="card"><small>Flagged</small><div className="stat">{dash.flaggedOrders}</div></div>
          </div>
        </section>
      )}

      <section className="section">
        <h3>Offers waiting</h3>
        {!offers.length && <p className="hint">None.</p>}
        {offers.map((o) => (
          <div className="order" key={o._id}>
            <div className="order-items"><b>{o.product?.name || "Item"}</b> · listed {peso(o.product?.price || 0)}, offered <span className="price">{peso(o.amount)}</span></div>
            <div className="order-actions">
              <button className="accent" onClick={() => go(() => api("/admin/offers/" + o._id, { method: "PATCH", body: { decision: "accepted" } }))}>Accept</button>
              <button className="danger" onClick={() => go(() => api("/admin/offers/" + o._id, { method: "PATCH", body: { decision: "rejected" } }))}>Reject</button>
            </div>
          </div>
        ))}
      </section>

      <section className="section">
        <h3>Orders</h3>
        <div className="scroll">
          <table>
            <tbody>
              {orders.map((o) => (
                <tr key={o._id}>
                  <td>#{o._id.slice(-6)}</td>
                  <td><span className={"tag st-" + o.status}>{o.status.replace(/_/g, " ")}</span>{o.flag && " ⚠ " + o.flag}</td>
                  <td>{peso(o.total)}</td>
                  <td>
                    {NEXT[o.status] && <button className="sm" onClick={() => go(() => api("/admin/orders/" + o._id + "/status", { method: "PATCH", body: { status: NEXT[o.status] } }))}>→ {NEXT[o.status]}</button>}
                    {o.status === "pending_payment" && <button className="sm alt" onClick={() => go(() => api("/admin/orders/" + o._id + "/reconcile", { method: "POST" }))}>Reconcile</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h3>Add item</h3>
        <div className="admin-form">
          <label>Name<input placeholder="e.g. Washed Denim Jacket" value={np.name} onChange={field("name")} required /></label>
          <label>Price (₱)<input type="number" inputMode="decimal" min="1" placeholder="650" value={np.price} onChange={field("price")} required /></label>
          <label>Brand<input placeholder="e.g. Nike" value={np.brand} onChange={field("brand")} /></label>
          <label>Category<select value={np.category} onChange={field("category")}><option value="">Choose…</option>{cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label>
          <label>Size<input placeholder="e.g. M" value={np.size} onChange={field("size")} /></label>
          <label>Condition<select value={np.condition} onChange={field("condition")}><option value="like_new">Like new</option><option value="good">Good</option><option value="fair">Fair</option><option value="worn">Worn</option></select></label>
          <label className="grow">Photo URL (optional)<input type="url" placeholder="https://…" value={np.imageUrl} onChange={field("imageUrl")} /></label>
          <label className="grow">Description<textarea placeholder="Brand, color, measurements, flaws" value={np.description} onChange={field("description")} /></label>
          <button className="accent" disabled={!np.name || !(+np.price > 0)} onClick={() => go(async () => {
            await api("/admin/products", { method: "POST", body: {
              name: np.name, price: Math.round(+np.price * 100), size: np.size || undefined,
              description: np.description || undefined, brand: np.brand || undefined,
              imageUrl: np.imageUrl || undefined, category: np.category || undefined,
              condition: np.condition, stock: 1,
            } });
            setNp(EMPTY_PRODUCT);
          })}>Add item</button>
        </div>
      </section>

      <section className="section">
        <h3>Items</h3>
        <div className="scroll">
          <table>
            <tbody>
              {products.map((p) => (
                <tr key={p._id}>
                  <td>{p.name}</td>
                  <td>{peso(p.price)}</td>
                  <td>stock {p.stock}</td>
                  <td>
                    <button className="sm alt" onClick={() => go(() => api("/admin/products/" + p._id + "/stock", { method: "PATCH", body: { stock: p.stock ? 0 : 1, reason: "admin adjust" } }))}>{p.stock ? "Mark sold" : "Restock"}</button>
                    <button className="sm danger" onClick={() => { if (window.confirm("Delete " + p.name + "? This cannot be undone.")) go(() => api("/admin/products/" + p._id, { method: "DELETE" })); }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h3>New coupon</h3>
        <div className="admin-form">
          <label>Code<input placeholder="CODE" value={cp.code} onChange={(e) => setCp({ ...cp, code: e.target.value.toUpperCase() })} /></label>
          <label>Type<select value={cp.type} onChange={(e) => setCp({ ...cp, type: e.target.value })}><option value="percent">Percent</option><option value="fixed">Fixed (centavos)</option></select></label>
          <label>Value<input type="number" min="1" placeholder="10" value={cp.value} onChange={(e) => setCp({ ...cp, value: e.target.value })} /></label>
          <button disabled={!cp.code || !(+cp.value > 0)} onClick={() => go(async () => {
            await api("/admin/coupons", { method: "POST", body: { code: cp.code, type: cp.type, value: +cp.value } });
            setCp({ code: "", type: "percent", value: "" });
          })}>Create coupon</button>
        </div>
      </section>
    </div>
  );
}
