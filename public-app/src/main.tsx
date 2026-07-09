import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useAuth } from "./useAuth";
import { LoginPage } from "./LoginPage";
import { ChatPage } from "./ChatPage";
import { AdminPanel } from "./AdminPanel";
import "./style.css";

function App() {
  const { user, loading, login, logout } = useAuth();

  // Admin route
  const isAdmin = window.location.pathname === "/admin";
  if (isAdmin) {
    return (
      <div
        style={{
          fontFamily: "system-ui",
          background: "#fafafa",
          minHeight: "100vh",
        }}
      >
        <div
          className="top-bar"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 16px",
            borderBottom: "1px solid #e5e5e5",
            background: "#fafafa",
          }}
        >
          <span
            className="top-bar-title"
            style={{ fontWeight: 700, fontSize: 16 }}
          >
            GezyTech{" "}
            <span style={{ fontWeight: 400, color: "#9ca3af", fontSize: 13 }}>
              / Admin
            </span>
          </span>
          <a
            href="/"
            style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}
          >
            ← Back to chat
          </a>
        </div>
        <AdminPanel />
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{ padding: 40, fontFamily: "system-ui", textAlign: "center" }}
      >
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={login} />;
  }

  // Extract session ID from URL: /c/<sessionId>
  const pathMatch = window.location.pathname.match(/^\/c\/([a-zA-Z0-9-]+)/);
  const urlSessionId = pathMatch ? pathMatch[1] : undefined;

  return (
    <div style={{ fontFamily: "system-ui" }}>
      {/* Top bar */}
      <div
        className="top-bar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 16px",
          borderBottom: "1px solid #e5e5e5",
          background: "#fafafa",
        }}
      >
        <a
          href="/"
          className="top-bar-title"
          style={{
            fontWeight: 700,
            fontSize: 16,
            color: "inherit",
            textDecoration: "none",
          }}
        >
          GezyTech
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            className="top-bar-user"
            style={{ fontSize: 13, color: "#666" }}
          >
            {user.displayName} · {user.agentSlug}
          </span>
          <button
            className="top-bar-btn"
            onClick={logout}
            style={{
              padding: "4px 12px",
              background: "transparent",
              color: "#ef4444",
              border: "1px solid #ef4444",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Chat area */}
      <ChatPage agentSlug={user.agentSlug} initialSessionId={urlSessionId} />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
