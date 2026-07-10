import { useState } from "react";
import { useAuth } from "./useAuth";
import { Dashboard } from "./Dashboard";
import { Usage } from "./Usage";
import { TopUp } from "./TopUp";
import { Billing } from "./Billing";
import { Profile } from "./Profile";

const fmtMoney = (n: number) => "Rp " + n.toLocaleString("id-ID");

export function App() {
  const { user, loading, logout } = useAuth();
  const [page, setPage] = useState<"dashboard" | "usage" | "topup" | "billing" | "profile">("dashboard");

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>GezyTech Platform</h1>
          <p>Login dengan akun GezyTech untuk mengakses dashboard.</p>
          <button className="btn btn-primary" onClick={() => (window.location.href = "/api/auth/login")}>
            Login dengan GezyTech
          </button>
        </div>
      </div>
    );
  }

  const renderPage = () => {
    switch (page) {
      case "usage":
        return <Usage />;
      case "topup":
        return <TopUp />;
      case "billing":
        return <Billing />;
      case "profile":
        return <Profile />;
      case "dashboard":
      default:
        return <Dashboard />;
    }
  };

  const navItem = (key: typeof page, label: string) => (
    <button
      className={`sidebar-item ${page === key ? "active" : ""}`}
      onClick={() => setPage(key)}
    >
      {label}
    </button>
  );

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">GezyTech Platform</div>
        <nav className="sidebar-nav">
          {navItem("dashboard", "Dashboard")}
          {navItem("usage", "Pemakaian")}
          {navItem("topup", "Top Up")}
          {navItem("billing", "Billing")}
          {navItem("profile", "Profil")}
        </nav>
        <div className="sidebar-footer">
          <div><strong>{user.displayName}</strong></div>
          <div>{user.email}</div>
          <div style={{ marginTop: 4 }}>Saldo: {fmtMoney(user.balance)}</div>
          <button
            className="btn btn-danger"
            style={{ marginTop: 10, width: "100%" }}
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </aside>
      <main className="main">{renderPage()}</main>
    </div>
  );
}
