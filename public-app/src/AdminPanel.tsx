import { useState, useEffect } from "react";

interface User {
  id: string;
  email: string;
  displayName: string | null;
  agentSlug: string;
  createdAt: number;
}

interface ToolRequest {
  id: string;
  userId: string;
  toolName: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  adminNote: string | null;
  createdAt: number;
  reviewedAt: number | null;
}

interface SoulRequest {
  id: string;
  userId: string;
  soulText: string;
  status: "pending" | "approved" | "rejected";
  adminNote: string | null;
  createdAt: number;
  reviewedAt: number | null;
}

const API_BASE = "/api/admin";

function useAdminApi(token: string) {
  const headers = {
    "x-admin-token": token,
    "Content-Type": "application/json",
  };

  async function approveToolRequest(id: string, adminNote: string) {
    const res = await fetch(`${API_BASE}/tool-requests/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ action: "approve", adminNote }),
    });
    if (!res.ok) throw new Error("Failed");
    return res.json();
  }

  async function rejectToolRequest(id: string, adminNote: string) {
    const res = await fetch(`${API_BASE}/tool-requests/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ action: "reject", adminNote }),
    });
    if (!res.ok) throw new Error("Failed");
    return res.json();
  }

  async function approveSoulRequest(id: string, adminNote: string) {
    const res = await fetch(`${API_BASE}/soul-requests/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ action: "approve", adminNote }),
    });
    if (!res.ok) throw new Error("Failed");
    return res.json();
  }

  async function rejectSoulRequest(id: string, adminNote: string) {
    const res = await fetch(`${API_BASE}/soul-requests/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ action: "reject", adminNote }),
    });
    if (!res.ok) throw new Error("Failed");
    return res.json();
  }

  async function syncAgents() {
    const res = await fetch(`${API_BASE}/sync-agents`, {
      method: "POST",
      headers,
    });
    if (!res.ok) throw new Error("Failed");
    return res.json();
  }

  return {
    approveToolRequest,
    rejectToolRequest,
    approveSoulRequest,
    rejectSoulRequest,
    syncAgents,
  };
}

export function AdminPanel() {
  const [token, setToken] = useState(
    () => localStorage.getItem("admin_token") ?? "",
  );
  const [authOk, setAuthOk] = useState(false);
  const [tab, setTab] = useState<"users" | "tools" | "souls">("tools");

  const [users, setUsers] = useState<User[]>([]);
  const [toolRequests, setToolRequests] = useState<ToolRequest[]>([]);
  const [soulRequests, setSoulRequests] = useState<SoulRequest[]>([]);

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const api = useAdminApi(token);

  // Verify token on mount or change
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/users`, { headers: { "x-admin-token": token } })
      .then((r) => {
        if (r.ok) {
          setAuthOk(true);
          localStorage.setItem("admin_token", token);
        } else {
          setError("Invalid admin token");
          localStorage.removeItem("admin_token");
        }
      })
      .catch(() => setError("Connection failed"));
  }, [token]);

  // Load data when tab changes
  useEffect(() => {
    if (!authOk) return;
    setLoading(true);
    const headers = { "x-admin-token": token };

    Promise.all([
      fetch(`${API_BASE}/users`, { headers }).then((r) =>
        r.ok ? r.json() : null,
      ),
      fetch(`${API_BASE}/tool-requests`, { headers }).then((r) =>
        r.ok ? r.json() : null,
      ),
      fetch(`${API_BASE}/soul-requests`, { headers }).then((r) =>
        r.ok ? r.json() : null,
      ),
    ])
      .then(([u, t, s]) => {
        if (u?.users) setUsers(u.users);
        if (t?.requests) setToolRequests(t.requests);
        if (s?.requests) setSoulRequests(s.requests);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authOk, tab, token]);

  const refresh = () => {
    if (!authOk) return;
    const headers = { "x-admin-token": token };
    fetch(`${API_BASE}/tool-requests`, { headers })
      .then((r) => r.json())
      .then((d) => setToolRequests(d.requests ?? []))
      .catch(() => {});
    fetch(`${API_BASE}/soul-requests`, { headers })
      .then((r) => r.json())
      .then((d) => setSoulRequests(d.requests ?? []))
      .catch(() => {});
  };

  const handleToolAction = async (id: string, action: "approve" | "reject") => {
    const note = notes[id] ?? "";
    try {
      if (action === "approve") await api.approveToolRequest(id, note);
      else await api.rejectToolRequest(id, note);
      setNotes((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
      refresh();
    } catch {
      alert("Failed");
    }
  };

  const handleSoulAction = async (id: string, action: "approve" | "reject") => {
    const note = notes[id] ?? "";
    try {
      if (action === "approve") await api.approveSoulRequest(id, note);
      else await api.rejectSoulRequest(id, note);
      setNotes((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
      refresh();
    } catch {
      alert("Failed");
    }
  };

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      pending: "#f59e0b",
      approved: "#16a34a",
      rejected: "#dc2626",
    };
    return (
      <span
        style={{
          padding: "2px 8px",
          borderRadius: 10,
          fontSize: 11,
          fontWeight: 600,
          background: colors[s] + "20",
          color: colors[s],
        }}
      >
        {s.toUpperCase()}
      </span>
    );
  };

  const formatDate = (ts: number) => {
    if (!ts) return "-";
    return new Date(ts).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ── Token prompt ──
  if (!authOk) {
    return (
      <div style={{ maxWidth: 400, margin: "60px auto", padding: 20 }}>
        <h2 style={{ marginBottom: 16, fontSize: 20 }}>🔐 Admin Access</h2>
        {error && (
          <div
            style={{
              padding: "8px 12px",
              background: "#fef2f2",
              color: "#dc2626",
              borderRadius: 6,
              marginBottom: 12,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}
        <input
          type="password"
          value={token}
          onChange={(e) => {
            setToken(e.target.value);
            setError("");
          }}
          placeholder="Enter admin token..."
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid #ddd",
            borderRadius: 8,
            fontSize: 14,
            marginBottom: 12,
            boxSizing: "border-box",
          }}
          onKeyDown={(e) =>
            e.key === "Enter" &&
            token &&
            fetch(`${API_BASE}/users`, {
              headers: { "x-admin-token": token },
            }).then((r) => (r.ok ? setAuthOk(true) : setError("Invalid token")))
          }
        />
        <button
          onClick={() => {
            if (!token) return;
            fetch(`${API_BASE}/users`, { headers: { "x-admin-token": token } })
              .then((r) => (r.ok ? setAuthOk(true) : setError("Invalid token")))
              .catch(() => setError("Connection failed"));
          }}
          style={{
            width: "100%",
            padding: "10px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Unlock
        </button>
        <p
          style={{
            fontSize: 12,
            color: "#9ca3af",
            marginTop: 8,
            textAlign: "center",
          }}
        >
          Use the ADMIN_TOKEN configured in the server environment.
        </p>
      </div>
    );
  }

  // ── Dashboard ──
  const pendingTools = toolRequests.filter(
    (r) => r.status === "pending",
  ).length;
  const pendingSouls = soulRequests.filter(
    (r) => r.status === "pending",
  ).length;

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: 20,
        fontFamily: "system-ui",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 22 }}>🛡️ Admin Panel</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={async () => {
              setError("");
              try {
                const r = await api.syncAgents();
                if (r.needsManualFix?.length > 0) {
                  const list = r.needsManualFix
                    .map((m: any) => `${m.email} → ${m.oldSlug}`)
                    .join("\n");
                  alert(
                    `✅ ${r.autoFixed} users auto-fixed.\n\n⚠️ Manual fix needed:\n${list}\n\nAvailable agents: ${r.agents?.map((a: any) => a.slug).join(", ")}`,
                  );
                } else {
                  alert(
                    `✅ Sycned! ${r.totalUsers} users OK, ${r.autoFixed} fixed.`,
                  );
                }
              } catch (e: any) {
                setError(e.message);
              }
            }}
            style={{
              padding: "4px 12px",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            🔄 Sync Agents
          </button>
          <button
            onClick={() => {
              setAuthOk(false);
              setToken("");
              localStorage.removeItem("admin_token");
            }}
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
            Lock
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
          borderBottom: "2px solid #e5e5e5",
        }}
      >
        {(
          [
            ["tools", "🔧 Tool Requests", pendingTools],
            ["souls", "✨ SOUL Requests", pendingSouls],
            ["users", "👥 Users", null],
          ] as const
        ).map(([key, label, badge]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: "8px 16px",
              border: "none",
              background: "transparent",
              borderBottom:
                tab === key ? "2px solid #2563eb" : "2px solid transparent",
              color: tab === key ? "#2563eb" : "#6b7280",
              fontWeight: tab === key ? 600 : 400,
              fontSize: 14,
              cursor: "pointer",
              marginBottom: -2,
              position: "relative",
            }}
          >
            {label}
            {badge != null && badge > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  padding: "1px 6px",
                  borderRadius: 10,
                  fontSize: 11,
                  background: "#ef4444",
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div className="skeleton" style={{ height: 200, width: "100%" }} />
      )}

      {/* Tab: Tool Requests */}
      {!loading && tab === "tools" && (
        <div>
          {toolRequests.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔧</div>
              <div className="empty-state-title">No tool requests</div>
              <div className="empty-state-desc">
                Users haven't requested any tools yet.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {toolRequests.map((req) => (
                <div
                  key={req.id}
                  style={{
                    padding: 14,
                    background: "#fff",
                    border: "1px solid #e5e5e5",
                    borderRadius: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 15 }}>
                        {req.toolName}
                      </span>
                      {statusBadge(req.status)}
                    </div>
                    {req.reason && (
                      <div
                        style={{
                          fontSize: 13,
                          color: "#6b7280",
                          marginBottom: 4,
                        }}
                      >
                        Reason: {req.reason}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>
                      User: {req.userId.slice(0, 8)}... ·{" "}
                      {formatDate(req.createdAt)}
                      {req.adminNote && <> · Note: "{req.adminNote}"</>}
                    </div>
                  </div>

                  {req.status === "pending" && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        minWidth: 160,
                      }}
                    >
                      <input
                        type="text"
                        value={notes[req.id] ?? ""}
                        onChange={(e) =>
                          setNotes((prev) => ({
                            ...prev,
                            [req.id]: e.target.value,
                          }))
                        }
                        placeholder="Admin note..."
                        style={{
                          width: "100%",
                          padding: "4px 8px",
                          border: "1px solid #ddd",
                          borderRadius: 6,
                          fontSize: 12,
                          boxSizing: "border-box",
                        }}
                      />
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          onClick={() => handleToolAction(req.id, "approve")}
                          style={{
                            flex: 1,
                            padding: "4px 10px",
                            background: "#16a34a",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleToolAction(req.id, "reject")}
                          style={{
                            flex: 1,
                            padding: "4px 10px",
                            background: "#dc2626",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: SOUL Requests */}
      {!loading && tab === "souls" && (
        <div>
          {soulRequests.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">✨</div>
              <div className="empty-state-title">No SOUL requests</div>
              <div className="empty-state-desc">
                Users haven't requested persona changes yet.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {soulRequests.map((req) => (
                <div
                  key={req.id}
                  style={{
                    padding: 14,
                    background: "#fff",
                    border: "1px solid #e5e5e5",
                    borderRadius: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 15 }}>
                        SOUL Request
                      </span>
                      {statusBadge(req.status)}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#374151",
                        marginBottom: 4,
                        background: "#f9fafb",
                        padding: "8px 10px",
                        borderRadius: 6,
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.4,
                      }}
                    >
                      {req.soulText.slice(0, 200)}
                      {req.soulText.length > 200 && "..."}
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>
                      User: {req.userId.slice(0, 8)}... ·{" "}
                      {formatDate(req.createdAt)}
                      {req.adminNote && <> · Note: "{req.adminNote}"</>}
                    </div>
                  </div>

                  {req.status === "pending" && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        minWidth: 160,
                      }}
                    >
                      <input
                        type="text"
                        value={notes[req.id] ?? ""}
                        onChange={(e) =>
                          setNotes((prev) => ({
                            ...prev,
                            [req.id]: e.target.value,
                          }))
                        }
                        placeholder="Admin note..."
                        style={{
                          width: "100%",
                          padding: "4px 8px",
                          border: "1px solid #ddd",
                          borderRadius: 6,
                          fontSize: 12,
                          boxSizing: "border-box",
                        }}
                      />
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          onClick={() => handleSoulAction(req.id, "approve")}
                          style={{
                            flex: 1,
                            padding: "4px 10px",
                            background: "#16a34a",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleSoulAction(req.id, "reject")}
                          style={{
                            flex: 1,
                            padding: "4px 10px",
                            background: "#dc2626",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Users */}
      {!loading && tab === "users" && (
        <div>
          {users.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              <div className="empty-state-title">No users</div>
              <div className="empty-state-desc">
                Create users via the admin API.
              </div>
            </div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                  <th
                    style={{
                      padding: "8px 12px",
                      borderBottom: "1px solid #e5e5e5",
                    }}
                  >
                    Email
                  </th>
                  <th
                    style={{
                      padding: "8px 12px",
                      borderBottom: "1px solid #e5e5e5",
                    }}
                  >
                    Name
                  </th>
                  <th
                    style={{
                      padding: "8px 12px",
                      borderBottom: "1px solid #e5e5e5",
                    }}
                  >
                    Agent
                  </th>
                  <th
                    style={{
                      padding: "8px 12px",
                      borderBottom: "1px solid #e5e5e5",
                    }}
                  >
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td
                      style={{
                        padding: "8px 12px",
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      {u.email}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      {u.displayName ?? "-"}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      <code
                        style={{
                          background: "#f3f4f6",
                          padding: "1px 6px",
                          borderRadius: 4,
                          fontSize: 12,
                        }}
                      >
                        {u.agentSlug}
                      </code>
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        borderBottom: "1px solid #f3f4f6",
                        color: "#9ca3af",
                      }}
                    >
                      {formatDate(u.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
