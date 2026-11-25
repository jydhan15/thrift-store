import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Routes, Route, Link, NavLink, Navigate, useNavigate, useLocation } from "react-router-dom";
import { api } from "./api.js";
import Shop, { Product } from "./pages/Shop.jsx";
import Cart from "./pages/Cart.jsx";
import Orders from "./pages/Orders.jsx";
import { Login, Register } from "./pages/Auth.jsx";
import Admin from "./pages/Admin.jsx";

export const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const ICONS = {
  shop: "M4 9h16l-1.2 11H5.2L4 9z M8.5 9V7a3.5 3.5 0 0 1 7 0v2",
  cart: "M3 5h2l2.2 10h10.3L20 8H6.3 M9.5 19.5h.01 M17 19.5h.01",
  orders: "M6 3h9l3 3v15H6V3z M14 3v4h4 M9 12h6 M9 16h4",
  admin: "M4 4h6v6H4z M14 4h6v4h-6z M14 10h6v10h-6z M4 12h6v8H4z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4.5 21c.5-4 3.5-6 7.5-6s7 2 7.5 6",
  join: "M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M3 21c.4-4 3.2-6 7-6 M18 8v8 M14 12h8",
};
const Icon = ({ name }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={ICONS[name]} />
  </svg>
);
const Tab = ({ to, icon, label, badge, end }) => (
  <NavLink to={to} end={end}>
    <span className="ico">
      <Icon name={icon} />
      {badge > 0 && <b className="badge">{badge > 9 ? "9+" : badge}</b>}
    </span>
    <span className="lbl">{label}</span>
  </NavLink>
);

const readUser = () => {
  try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
};

export default function App() {
  const [user, setUser] = useState(readUser);
  const [count, setCount] = useState(0);
  const nav = useNavigate();
  const loc = useLocation();

  const clearSession = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setCount(0);
  }, []);

  // Exposed so pages can keep the cart badge in sync after add/remove/checkout.
  const refreshCart = useCallback(async () => {
    if (!localStorage.getItem("token")) { setCount(0); return; }
    try {
      const r = await api("/cart");
      setCount(r.data.items.length);
    } catch { setCount(0); }
  }, []);

  useEffect(() => { refreshCart(); }, [refreshCart, user, loc.pathname]);

  useEffect(() => {
    const onExpired = () => { clearSession(); nav("/login", { replace: true }); };
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, [clearSession, nav]);

  // On a phone, landing halfway down the previous page feels broken.
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);

  const login = useCallback((token, u) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(u));
    setUser(u);
  }, []);
  const logout = useCallback(() => { clearSession(); nav("/"); }, [clearSession, nav]);

  const value = useMemo(() => ({ user, login, logout, refreshCart }), [user, login, logout, refreshCart]);
  const firstName = (user?.name || "").trim().split(/\s+/)[0] || "Account";

  return (
    <AuthCtx.Provider value={value}>
      <a className="skip-link" href="#content">Skip to content</a>
      <div className="app">
        <header className="topbar">
          <div className="topbar-in">
            <Link to="/" className="brand" aria-label="Thrift and Co home">
              <span className="brand-mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 7a2.5 2.5 0 1 1 2.5-2.5 M12 7l9 6h-5l-4 8-4-8H3l9-6z" /></svg>
              </span>
              <span className="brand-text">Thrift<em>&amp;</em>Co</span>
            </Link>

            <nav className="navlinks" aria-label="Shop">
              <NavLink to="/" end>Shop</NavLink>
              {user && <NavLink to="/cart">Cart{count > 0 && <span className="badge">{count}</span>}</NavLink>}
              {user && <NavLink to="/orders">Orders</NavLink>}
              {user?.role === "admin" && <NavLink to="/admin">Admin</NavLink>}
            </nav>

            <span className="spacer" />

            {user ? (
              <div className="userchip">
                <span className="avatar" aria-hidden="true">{firstName[0].toUpperCase()}</span>
                <span className="who">{firstName}</span>
                <button className="btn ghost sm" onClick={logout}>Log out</button>
              </div>
            ) : (
              <nav className="navlinks" aria-label="Account">
                <NavLink to="/login">Log in</NavLink>
                <NavLink to="/register">Join</NavLink>
              </nav>
            )}

            {user && (
              <Link to="/cart" className="icon-btn" aria-label={"Cart, " + count + " items"}>
                <Icon name="cart" />
                {count > 0 && <b className="badge">{count > 9 ? "9+" : count}</b>}
              </Link>
            )}
          </div>
        </header>

        <main id="content">
          <Routes>
            <Route path="/" element={<Shop />} />
            <Route path="/products/:id" element={<Product />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/cart" element={user ? <Cart /> : <Navigate to="/login" />} />
            <Route path="/orders" element={user ? <Orders /> : <Navigate to="/login" />} />
            <Route path="/orders/:id" element={user ? <Orders /> : <Navigate to="/login" />} />
            <Route path="/admin" element={user?.role === "admin" ? <Admin /> : <Navigate to="/" />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>

        <nav className="tabbar" aria-label="Primary">
          <Tab to="/" end icon="shop" label="Shop" />
          {user && <Tab to="/cart" icon="cart" label="Cart" badge={count} />}
          {user && <Tab to="/orders" icon="orders" label="Orders" />}
          {user?.role === "admin" && <Tab to="/admin" icon="admin" label="Admin" />}
          {!user && <Tab to="/login" icon="user" label="Login" />}
          {!user && <Tab to="/register" icon="join" label="Join" />}
        </nav>
      </div>
    </AuthCtx.Provider>
  );
}
