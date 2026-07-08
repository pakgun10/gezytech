import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useAuth } from "./useAuth";
import { LoginPage } from "./LoginPage";
import { ChatPage } from "./ChatPage";

function App() {
  const { user, loading, login, logout } = useAuth();

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

  return (
    <div style={{ fontFamily: "system-ui" }}>
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 16px",
          borderBottom: "1px solid #e5e5e5",
          background: "#fafafa",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 16 }}>GezyTech</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "#666" }}>
            {user.displayName} · {user.agentSlug}
          </span>
          <button
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
      <ChatPage agentSlug={user.agentSlug} />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
