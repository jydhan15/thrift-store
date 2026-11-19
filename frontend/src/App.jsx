import { createContext, useContext, useState } from "react";
import { Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";
import Shop, { Product } from "./pages/Shop.jsx"; import Cart from "./pages/Cart.jsx"; import Orders from "./pages/Orders.jsx";
import { Login, Register } from "./pages/Auth.jsx"; import Admin from "./pages/Admin.jsx";
export const AuthCtx = createContext(null); export const useAuth = () => useContext(AuthCtx);
export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user") || "null"));
  const nav = useNavigate();
  const login = (token, u) => { localStorage.setItem("token", token); localStorage.setItem("user", JSON.stringify(u)); setUser(u); };
  const logout = () => { localStorage.clear(); setUser(null); nav("/"); };
  return (
    <AuthCtx.Provider value={{ user, login }}>
      <nav><b>🧥 Thrift Store</b><Link to="/">Shop</Link>{user && <Link to="/cart">Cart</Link>}{user && <Link to="/orders">Orders</Link>}
        {user?.role === "admin" && <Link to="/admin">Admin</Link>}<span className="sp" />
        {user ? <><span>{user.name}</span><button className="alt" onClick={logout}>Logout</button></> : <><Link to="/login">Login</Link><Link to="/register">Register</Link></>}</nav>
      <main><Routes>
        <Route path="/" element={<Shop />} /><Route path="/products/:id" element={<Product />} />
        <Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} />
        <Route path="/cart" element={user ? <Cart /> : <Navigate to="/login" />} />
        <Route path="/orders" element={user ? <Orders /> : <Navigate to="/login" />} />
        <Route path="/orders/:id" element={user ? <Orders /> : <Navigate to="/login" />} />
        <Route path="/admin" element={user?.role === "admin" ? <Admin /> : <Navigate to="/" />} />
      </Routes></main>
    </AuthCtx.Provider>);
}
