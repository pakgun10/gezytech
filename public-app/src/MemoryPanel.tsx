import { useState, useEffect } from "react";

interface MemoryItem {
  id: string;
  content: string;
  category: string;
  importance: number;
  scope: string;
  createdAt: string;
  retrievalCount: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  fact: "#3b82f6",
  preference: "#8b5cf6",
  identity: "#10b981",
  instruction: "#f59e0b",
  relationship: "#ec4899",
};

export function MemoryPanel() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/memory")
      .then((r) => r.json())
      .then((data) => setMemories(data.memories || []))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => {
          setOpen(!open);
        }}
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
        🧠 Memory {memories.length > 0 ? `(${memories.length})` : ""}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 6,
            width: 360,
            maxHeight: 440,
            overflow: "auto",
            background: "#fff",
            border: "1px solid #e5e5e5",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 10,
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid #e5e5e5",
              fontWeight: 600,
              fontSize: 13,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>🧠 Agent Memory</span>
            <span style={{ color: "#999", fontSize: 11, fontWeight: 400 }}>
              {memories.length} item{memories.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ padding: 8 }}>
            {loading && (
              <p style={{ padding: 12, color: "#999", fontSize: 13 }}>
                Loading...
              </p>
            )}
            {!loading && memories.length === 0 && (
              <p style={{ padding: 12, color: "#999", fontSize: 13 }}>
                Agent belum punya memory tentang kamu.
              </p>
            )}
            {memories.map((m) => (
              <div
                key={m.id}
                style={{
                  padding: "8px 10px",
                  fontSize: 13,
                  borderBottom: "1px solid #f3f4f6",
                  lineHeight: 1.4,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 2,
                  }}
                >
                  <span
                    style={{
                      padding: "1px 6px",
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 600,
                      background:
                        (CATEGORY_COLORS[m.category] ?? "#6b7280") + "18",
                      color: CATEGORY_COLORS[m.category] ?? "#6b7280",
                    }}
                  >
                    {m.category}
                  </span>
                  <span style={{ fontSize: 10, color: "#999" }}>
                    ⭐{"★".repeat(Math.min(m.importance, 5))}
                    {"☆".repeat(Math.max(0, 5 - m.importance))}
                  </span>
                </div>
                <div>{m.content}</div>
                <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
                  {new Date(m.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
