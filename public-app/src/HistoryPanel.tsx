import { useState, useEffect } from "react";

interface ChatSession {
  id: string;
  title: string | null;
  createdAt: number;
  updatedAt: number;
}

export function HistoryPanel({
  activeSessionId,
  onSelect,
  onNew,
}: {
  activeSessionId?: string;
  onSelect?: (session: ChatSession) => void;
  onNew?: () => void;
}) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data) => setSessions(data.sessions ?? []))
      .finally(() => setLoading(false));
  }, [open]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          padding: "6px 12px",
          background: open ? "#2563eb" : "#f3f4f6",
          color: open ? "#fff" : "#374151",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        💬 Sessions {sessions.length > 0 ? `(${sessions.length})` : ""}
      </button>

      {open && (
        <div
          className="panel-dropdown"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 6,
            width: 300,
            maxHeight: 450,
            overflow: "auto",
            background: "#fff",
            border: "1px solid #e5e5e5",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            zIndex: 10,
          }}
        >
          {/* New Chat button */}
          <div style={{ padding: 8, borderBottom: "1px solid #e5e5e5" }}>
            <button
              onClick={() => {
                onNew?.();
                setOpen(false);
              }}
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ➕ New Chat
            </button>
          </div>

          <div>
            {loading && (
              <p style={{ padding: 12, color: "#999", fontSize: 13 }}>
                Loading...
              </p>
            )}
            {!loading && sessions.length === 0 && (
              <p style={{ padding: 12, color: "#999", fontSize: 13 }}>
                No sessions yet.
              </p>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => {
                  onSelect?.(s);
                  setOpen(false);
                }}
                style={{
                  padding: "10px 12px",
                  cursor: "pointer",
                  borderBottom: "1px solid #f3f4f6",
                  fontSize: 13,
                  lineHeight: 1.4,
                  background:
                    s.id === activeSessionId ? "#eff6ff" : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (s.id !== activeSessionId)
                    (e.currentTarget as HTMLElement).style.background =
                      "#f9fafb";
                }}
                onMouseLeave={(e) => {
                  if (s.id !== activeSessionId)
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                }}
              >
                <div
                  style={{
                    color: "#374151",
                    marginBottom: 2,
                    fontWeight: s.id === activeSessionId ? 600 : 400,
                  }}
                >
                  {s.title || "Untitled chat"}
                </div>
                <div style={{ fontSize: 11, color: "#999" }}>
                  {formatTime(s.createdAt)}
                  {s.id === activeSessionId && (
                    <span
                      style={{
                        marginLeft: 8,
                        color: "#2563eb",
                        fontWeight: 600,
                      }}
                    >
                      active
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
