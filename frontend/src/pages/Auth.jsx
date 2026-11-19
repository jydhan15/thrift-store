import { useState } from "react"; import { useNavigate } from "react-router-dom"; import { api } from "../api.js"; import { useAuth } from "../App.jsx";
function Form({ mode }) {
  const [f, setF] = useState({ name: "", email: "", password: "" }); const [err, setErr] = useState(""); const { login } = useAuth(); const nav = useNavigate();
  const submit = async (e) => { e.preventDefault(); setErr("");
    try { const body = mode === "register" ? f : { email: f.email, password: f.password };
      const r = await api("/auth/" + mode, { method: "POST", body }); login(r.data.token, r.data.user); nav("/"); }
    catch (x) { setErr(x.details ? Object.values(x.details).flat().join(", ") : x.message); } };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (<div className="card" style={{ maxWidth: 380, margin: "auto" }}><h2>{mode === "login" ? "Login" : "Register"}</h2>{err && <div className="err">{err}</div>}
    <form onSubmit={submit}>{mode === "register" && <input placeholder="Name" value={f.name} onChange={set("name")} />}
      <input placeholder="Email" value={f.email} onChange={set("email")} /><input type="password" placeholder="Password (8+ chars)" value={f.password} onChange={set("password")} />
      <button>{mode === "login" ? "Login" : "Create account"}</button></form></div>);
}
export const Login = () => <Form mode="login" />; export const Register = () => <Form mode="register" />;
