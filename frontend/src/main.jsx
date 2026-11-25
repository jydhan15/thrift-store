import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./style.css";
import "./mobile.css";

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    console.error("Thrift&Co crashed:", error);
  }
  render() {
    if (this.state.error) {
      return (
        <main style={{ maxWidth: 460, margin: "64px auto", padding: 20, textAlign: "center" }}>
          <h1>Something went wrong</h1>
          <p style={{ color: "#69736d" }}>The page could not load. Try refreshing — your cart and login are saved.</p>
          <button onClick={() => window.location.reload()}>Reload the app</button>
        </main>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
