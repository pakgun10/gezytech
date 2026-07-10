import { useEffect, useState } from "react";

interface ProfileData {
  id: string;
  email: string;
  displayName: string;
  agentSlug: string;
  balance: number;
  createdAt: number;
}

export function Profile() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [gdriveConnected, setGdriveConnected] = useState(false);
  const [gdriveLoading, setGdriveLoading] = useState(true);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        setDisplayName(data.displayName ?? "");
      });

    // Check GDrive connection status
    fetch("/api/connections/google-drive/status")
      .then((r) => r.json())
      .then((d) => setGdriveConnected(d.connected ?? false))
      .catch(() => {})
      .finally(() => setGdriveLoading(false));
  }, []);

  const connectGdrive = () => {
    // Redirect ke OAuth flow
    window.location.href = "/api/connections/google-drive/auth";
  };

  const disconnectGdrive = async () => {
    if (!confirm("Putuskan koneksi Google Drive?")) return;
    try {
      const res = await fetch("/api/connections/google-drive/disconnect", {
        method: "POST",
      });
      if (res.ok) {
        setGdriveConnected(false);
        setMessage("Google Drive berhasil diputuskan.");
      }
    } catch {
      setMessage("Gagal memutuskan koneksi.");
    }
  };

  // Check for OAuth callback params in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gdrive") === "connected") {
      setGdriveConnected(true);
      setMessage("Google Drive berhasil terhubung!");
      // Clear query params
      window.history.replaceState(null, "", "/settings");
    } else if (params.get("gdrive") === "error") {
      setMessage("Gagal menghubungkan Google Drive. Silakan coba lagi.");
      window.history.replaceState(null, "", "/settings");
    }
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      setMessage("Profil diperbarui.");
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  const fmtMoney = (n: number) => "Rp " + n.toLocaleString("id-ID");
  const fmtDate = (ts: number) => new Date(ts).toLocaleString("id-ID");

  if (!profile) return <div className="loading">Memuat profil...</div>;

  return (
    <div>
      <h1 className="page-title">Profil</h1>
      <div className="card" style={{ maxWidth: 480 }}>
        <div className="form-group">
          <label>Email</label>
          <input
            className="input"
            type="email"
            value={profile.email}
            disabled
          />
        </div>
        <div className="form-group">
          <label>Display Name</label>
          <input
            className="input"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Agent Slug</label>
          <input
            className="input"
            type="text"
            value={profile.agentSlug}
            disabled
          />
        </div>
        <div className="form-group">
          <label>Saldo</label>
          <input
            className="input"
            type="text"
            value={fmtMoney(profile.balance)}
            disabled
          />
        </div>
        <div className="form-group">
          <label>Bergabung</label>
          <input
            className="input"
            type="text"
            value={fmtDate(profile.createdAt)}
            disabled
          />
        </div>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan"}
        </button>
        {message && <p style={{ marginTop: 12, fontSize: 13 }}>{message}</p>}

        {/* Google Drive Connection */}
        <hr
          style={{
            margin: "20px 0",
            border: "none",
            borderTop: "1px solid #e5e5e5",
          }}
        />
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
            🔗 Google Drive
          </h3>
          {gdriveLoading ? (
            <p style={{ fontSize: 13, color: "#999" }}>Memeriksa status...</p>
          ) : gdriveConnected ? (
            <div>
              <p style={{ fontSize: 13, color: "#16a34a", marginBottom: 8 }}>
                ✅ Terhubung
              </p>
              <button
                onClick={disconnectGdrive}
                style={{
                  padding: "6px 14px",
                  fontSize: 13,
                  background: "#fee2e2",
                  color: "#dc2626",
                  border: "1px solid #fecaca",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Putuskan
              </button>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 13, color: "#999", marginBottom: 8 }}>
                Belum terhubung. Hubungkan untuk upload file ke Google Drive.
              </p>
              <button
                onClick={connectGdrive}
                style={{
                  padding: "6px 14px",
                  fontSize: 13,
                  background: "#2563eb",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Hubungkan Google Drive
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
