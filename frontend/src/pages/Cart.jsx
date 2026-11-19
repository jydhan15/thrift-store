import { useEffect, useState } from "react"; import { useNavigate } from "react-router-dom"; import { api, peso } from "../api.js";
export default function Cart() {
  const [cart, setCart] = useState({ items: [], subtotal: 0 }); const [f, setF] = useState({ fullName: "", address: "", phone: "" }); const [coupon, setCoupon] = useState("");
  const [err, setErr] = useState(""); const [key] = useState(() => crypto.randomUUID()); const [busy, setBusy] = useState(false);
  const load = () => api("/cart").then((r) => setCart(r.data)); useEffect(() => { load(); }, []);
  const remove = async (id) => { await api("/cart/items/" + id, { method: "DELETE" }); load(); };
  const pay = async () => { setErr(""); setBusy(true);
    try { const r = await api("/orders", { method: "POST", headers: { "Idempotency-Key": key }, body: { shippingInfo: f, ...(coupon && { couponCode: coupon }) } });
      window.location.href = r.data.checkoutUrl; } catch (e) { setErr(e.details ? Object.values(e.details).flat().join(", ") : e.message); setBusy(false); } };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (<div><h2>Your cart</h2>{!cart.items.length && <p>Cart is empty.</p>}
    {cart.items.map((i) => <div className="card" key={i.productId}><b>{i.name}</b> × {i.qty} — {peso(i.lineTotal)} <button className="danger" onClick={() => remove(i.productId)}>Remove</button></div>)}
    {cart.items.length > 0 && <div className="card" style={{ marginTop: 12 }}><h3>Subtotal {peso(cart.subtotal)} <small>(+ ₱50 shipping)</small></h3>
      <input placeholder="Full name" value={f.fullName} onChange={set("fullName")} /><input placeholder="Address" value={f.address} onChange={set("address")} /><input placeholder="Phone" value={f.phone} onChange={set("phone")} />
      <input placeholder="Coupon (WELCOME10, SAVE100)" value={coupon} onChange={(e) => setCoupon(e.target.value)} />{err && <div className="err">{err}</div>}
      <p><small>Items are reserved for 15 minutes once you check out.</small></p><button disabled={busy} onClick={pay}>{busy ? "Processing…" : "Checkout & pay"}</button></div>}</div>);
}
