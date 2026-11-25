import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../App.jsx";

function Form({ mode }) {
  const reg = mode === "register";
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const body = reg ? f : { email: f.email, password: f.password };
      const r = await api("/auth/" + mode, { method: "POST", body });
      login(r.data.token, r.data.user);
      nav("/", { replace: true });
    } catch (x) {
      setErr(x.details ? Object.values(x.details).flat().join(", ") : x.message);
    } finally { setBusy(false); }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="auth">
      <h1>{reg ? "Create your account" : "Welcome back"}</h1>
      <p className="hint">{reg ? "Join Thrift&Co to make offers and check out." : "Log in to pick up where you left off."}</p>
      {err && <div className="err" role="alert">{err}</div>}
      <form onSubmit={submit}>
        {reg && <label>Name<input autoComplete="name" value={f.name} onChange={set("name")} minLength={2} required /></label>}
        <label>Email<input type="email" autoComplete="email" inputMode="email" value={f.email} onChange={set("email")} required /></label>
        <label>Password{reg && <small> (8+ characters)</small>}
          <span className="pwwrap">
            <input type={show ? "text" : "password"} autoComplete={reg ? "new-password" : "current-password"} value={f.password} onChange={set("password")} minLength={reg ? 8 : undefined} required />
            <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}>{show ? "Hide" : "Show"}</button>
          </span>
        </label>
        <button className="btn accent wide" disabled={busy}>{busy ? "Please wait…" : reg ? "Create account" : "Log in"}</button>
      </form>
      <p className="hint" style={{ textAlign: "center", marginTop: 16 }}>
        {reg ? <>Already have an account? <Link to="/login">Log in</Link></> : <>New here? <Link to="/register">Create an account</Link></>}
      </p>
    </div>
  );
}

export const Login = () => <Form mode="login" />;
export const Register = () => <Form mode="register" />;
