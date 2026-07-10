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

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        setDisplayName(data.displayName ?? "");
      });
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
          <input className="input" type="email" value={profile.email} disabled />
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
          <input className="input" type="text" value={profile.agentSlug} disabled />
        </div>
        <div className="form-group">
          <label>Saldo</label>
          <input className="input" type="text" value={fmtMoney(profile.balance)} disabled />
        </div>
        <div className="form-group">
          <label>Bergabung</label>
          <input className="input" type="text" value={fmtDate(profile.createdAt)} disabled />
        </div>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan"}
        </button>
        {message && <p style={{ marginTop: 12, fontSize: 13 }}>{message}</p>}
      </div>
    </div>
  );
}
