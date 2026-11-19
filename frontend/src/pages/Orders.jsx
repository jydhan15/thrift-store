import { useEffect, useState } from "react"; import { api, peso } from "../api.js";
function Countdown({ to }) { const [s, setS] = useState(Math.max(0, Math.floor((new Date(to) - Date.now()) / 1000)));
  useEffect(() => { const t = setInterval(() => setS(Math.max(0, Math.floor((new Date(to) - Date.now()) / 1000))), 1000); return () => clearInterval(t); }, [to]);
  return <b>⏳ {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")} left to pay</b>; }
export default function Orders() {
  const [orders, setOrders] = useState([]); const [offers, setOffers] = useState([]); const [err, setErr] = useState("");
  const load = () => { api("/orders").then((r) => setOrders(r.data)); api("/offers/mine").then((r) => setOffers(r.data)); }; useEffect(() => { load(); }, []);
  const cancel = async (id) => { try { await api("/orders/" + id + "/cancel", { method: "POST" }); load(); } catch (e) { setErr(e.message); } };
  return (<div><h2>My orders</h2>{err && <div className="err">{err}</div>}{!orders.length && <p>No orders yet.</p>}
    {orders.map((o) => <div className="card" key={o._id} style={{ marginBottom: 8 }}><b>#{o._id.slice(-6)}</b> <span className="tag">{o.status}</span> {peso(o.total)}
      <div>{o.items.map((i) => i.name).join(", ")}</div>
      {o.status === "pending_payment" && <div className="row"><Countdown to={o.expiresAt} />{o.checkoutUrl && <a href={o.checkoutUrl}><button>Pay now</button></a>}<button className="danger" onClick={() => cancel(o._id)}>Cancel</button></div>}</div>)}
    <h2>My offers</h2>{!offers.length && <p>No offers.</p>}
    {offers.map((o) => <div className="card" key={o._id} style={{ marginBottom: 8 }}>{peso(o.amount)} <span className="tag">{o.status}</span> {o.status === "accepted" && <small>Accepted! Add the item to your cart. Your price applies at checkout.</small>}</div>)}</div>);
}
