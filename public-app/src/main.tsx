import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useAuth } from "./useAuth";
import { LoginPage } from "./LoginPage";

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
    <div style={{ padding: 40, fontFamily: "system-ui" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>GezyTech</h1>
          <p style={{ margin: "4px 0 0", color: "#666", fontSize: 14 }}>
            {user.displayName} ({user.email}) — Agent: {user.agentSlug}
          </p>
        </div>
        <button
          onClick={logout}
          style={{
            padding: "8px 16px",
            background: "#ef4444",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Logout
        </button>
      </div>

      <div
        style={{
          background: "#f0fdf4",
          border: "1px solid #86efac",
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <strong>✅ PUB-12: Login page complete</strong>
        <p style={{ margin: "4px 0 0", fontSize: 14, color: "#166534" }}>
          User is authenticated. Chat interface coming in PUB-22.
        </p>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
