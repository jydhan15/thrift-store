import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, peso, uuid } from "../api.js";
import { useAuth } from "../App.jsx";
import ProductImage, { Art } from "../components/ProductImage.jsx";

const SHIPPING = 5000; // centavos — matches backend/services/checkoutService.js

export default function Cart() {
  const [cart, setCart] = useState({ items: [], subtotal: 0 });
  const [loaded, setLoaded] = useState(false);
  const [f, setF] = useState({ fullName: "", address: "", phone: "" });
  const [coupon, setCoupon] = useState("");
  const [err, setErr] = useState("");
  const [key] = useState(uuid);
  const [busy, setBusy] = useState(false);
  const { refreshCart } = useAuth();

  const load = () =>
    api("/cart")
      .then((r) => { setCart(r.data); setLoaded(true); refreshCart(); })
      .catch((e) => { setErr(e.message); setLoaded(true); });
  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    setErr("");
    try { await api("/cart/items/" + id, { method: "DELETE" }); load(); }
    catch (e) { setErr(e.message); }
  };

  const pay = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const r = await api("/orders", {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: { shippingInfo: f, ...(coupon.trim() && { couponCode: coupon.trim() }) },
      });
      window.location.href = r.data.checkoutUrl;
    } catch (x) {
      setErr(x.details ? Object.values(x.details).flat().join(", ") : x.message);
      setBusy(false);
    }
  };

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (!loaded) return <div className="grid">{[1, 2].map((i) => <div className="card skel" key={i} />)}</div>;

  if (!cart.items.length) {
    return (
      <div className="empty">
        <span className="empty-art"><Art kind="bag" color="#9caf88" /></span>
        <h2>Your cart is empty</h2>
        <p>Items you add show up here. Each one is a one-off, so grab what you like.</p>
        <Link className="btn accent" to="/">Browse the shop</Link>
        {err && <div className="err" role="alert">{err}</div>}
      </div>
    );
  }

  return (
    <div className="cart">
      <h1>Your cart</h1>
      <div className="cart-grid">
        <div className="lines">
          {cart.items.map((i) => (
            <div className="line" key={i.productId}>
              <Link to={"/products/" + i.productId}><ProductImage name={i.name} imageUrl={i.imageUrl} /></Link>
              <div className="line-info">
                <Link to={"/products/" + i.productId}><b>{i.name}</b></Link>
                {i.qty > 1 && <small>Qty {i.qty}</small>}
                <span className="price">{peso(i.lineTotal)}</span>
              </div>
              <button className="btn ghost sm" onClick={() => remove(i.productId)} aria-label={"Remove " + i.name}>Remove</button>
            </div>
          ))}
        </div>

        <form className="summary" onSubmit={pay}>
          <h3>Checkout</h3>
          <div className="sum-row"><span>Subtotal</span><b>{peso(cart.subtotal)}</b></div>
          <div className="sum-row"><span>Shipping</span><b>{peso(SHIPPING)}</b></div>
          <div className="sum-row total"><span>Total</span><b>{peso(cart.subtotal + SHIPPING)}</b></div>
          <label>Full name<input autoComplete="name" value={f.fullName} onChange={set("fullName")} minLength={2} required /></label>
          <label>Address<input autoComplete="street-address" value={f.address} onChange={set("address")} minLength={5} required /></label>
          <label>Phone<input type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} minLength={7} required /></label>
          <label>Coupon code <small>(optional, e.g. WELCOME10)</small>
            <input value={coupon} onChange={(e) => setCoupon(e.target.value)} autoCapitalize="characters" enterKeyHint="done" />
          </label>
          {err && <div className="err" role="alert">{err}</div>}
          <p className="hint">Items are reserved for 15 minutes. Any coupon discount is applied at checkout.</p>
          <button className="btn accent wide" disabled={busy || !cart.items.length}>{busy ? "Processing…" : "Checkout and pay"}</button>
        </form>
      </div>
    </div>
  );
}
