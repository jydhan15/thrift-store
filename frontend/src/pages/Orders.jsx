import { useEffect, useState } from "react";
import { api, peso } from "../api.js";
import { useAuth } from "../App.jsx";

function Countdown({ to }) {
  const [s, setS] = useState(Math.max(0, Math.floor((new Date(to) - Date.now()) / 1000)));
  useEffect(() => {
    const tick = () => setS(Math.max(0, Math.floor((new Date(to) - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [to]);
  return <b className="count">⏳ {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")} left to pay</b>;
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [offers, setOffers] = useState([]);
  const [err, setErr] = useState("");
  const { refreshCart } = useAuth();

  const load = () => {
    api("/orders").then((r) => setOrders(r.data)).catch((e) => setErr(e.message));
    api("/offers/mine").then((r) => setOffers(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const cancel = async (id) => {
    setErr("");
    try { await api("/orders/" + id + "/cancel", { method: "POST" }); load(); refreshCart(); }
    catch (e) { setErr(e.message); }
  };
  // Pay / retry creates a NEW payment session for the same order on the server.
  const pay = async (id) => {
    setErr("");
    try { const r = await api("/orders/" + id + "/pay", { method: "POST" }); window.location.href = r.data.checkoutUrl; }
    catch (e) { setErr(e.message); load(); }
  };

  return (
    <div>
      <h1>My orders</h1>
      {err && <div className="err" role="alert">{err}</div>}
      {!orders.length && <div className="card"><p className="hint">No orders yet. Your paid orders and reservation timers will appear here.</p></div>}
      {orders.map((o) => (
        <div className="order" key={o._id}>
          <div className="order-top">
            <b>#{o._id.slice(-6)}</b>
            <span className={"tag st-" + o.status}>{o.status.replace(/_/g, " ")}</span>
            <span className="price">{peso(o.total)}</span>
          </div>
          <div className="order-items">{o.items.map((i) => i.name).join(", ")}</div>
          {(o.status === "pending_payment" || o.status === "payment_failed" || o.status === "expired") && (
            <div className="order-actions">
              {o.status === "pending_payment" && <Countdown to={o.expiresAt} />}
              {o.status !== "pending_payment" && <small>Payment did not go through. Your items were released.</small>}
              <button className="accent" onClick={() => pay(o._id)}>{o.status === "pending_payment" ? "Pay now" : "Retry payment"}</button>
              {o.status === "pending_payment" && <button className="danger" onClick={() => cancel(o._id)}>Cancel</button>}
            </div>
          )}
        </div>
      ))}

      <h2>My offers</h2>
      {!offers.length && <div className="card"><p className="hint">No offers yet. You can name your price on any item.</p></div>}
      {offers.map((o) => (
        <div className="order" key={o._id}>
          <div className="order-top">
            <span className="price">{peso(o.amount)}</span>
            <span className={"tag st-" + o.status}>{o.status.replace("_", " ")}</span>
          </div>
          {o.status === "accepted" && <small>Accepted! Add the item to your cart — your price applies at checkout.</small>}
        </div>
      ))}
    </div>
  );
}
