import { useState, useRef, useEffect } from "react";
import { MemoryPanel } from "./MemoryPanel";
import { HistoryPanel } from "./HistoryPanel";
import { SoulRequestButton } from "./SoulRequestButton";
import { ToolRequestButton } from "./ToolRequestButton";
import { TokenBar, triggerTokenRefresh } from "./TokenBar";

interface Message {
  id: string;
  role: "user" | "agent" | "tool" | "error";
  content: string;
  toolName?: string;
  timestamp: number;
}

export function ChatPage({ agentSlug }: { agentSlug: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sessionError, setSessionError] = useState(false);
  const [viewingHistory, setViewingHistory] = useState(false);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load chat history on mount
  useEffect(() => {
    fetch("/api/chat/history")
      .then((r) => {
        if (r.status === 401) {
          setSessionError(true);
          return null;
        }
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((data) => {
        if (data?.messages) {
          const formatted = data.messages.map((m: any) => ({
            id: m.id,
            role: m.role === "user" ? "user" : "agent",
            content: m.content,
            timestamp: m.timestamp,
          }));
          setAllMessages(formatted);
          setMessages(formatted);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));

    // Fetch active session or create one
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data) => {
        const sessions = data.sessions ?? [];
        if (sessions.length > 0) {
          setSessionId(sessions[0].id);
        } else {
          // No sessions yet — create first one
          fetch("/api/session/new", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "Chat 1" }),
          })
            .then((r) => r.json())
            .then((d) => setSessionId(d.session?.id ?? null));
        }
      })
      .catch(() => {});
  }, []);

  // Called when user selects a session from HistoryPanel
  const handleSelectHistory = (session: {
    id: string;
    title: string | null;
    createdAt: number;
  }) => {
    // Filter messages from this session's time window
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data) => {
        const sessions = (data.sessions ?? []) as Array<{
          id: string;
          createdAt: number;
        }>;
        // Find next session after this one to get end boundary
        const sorted = [...sessions].sort((a, b) => a.createdAt - b.createdAt);
        const idx = sorted.findIndex((s) => s.id === session.id);
        const endTime =
          idx < sorted.length - 1 ? sorted[idx + 1].createdAt : Date.now();

        const sessionMsgs = allMessages.filter(
          (m) => m.timestamp >= session.createdAt && m.timestamp < endTime,
        );
        setMessages(sessionMsgs.length > 0 ? sessionMsgs : []);
        setSessionId(session.id);
        setViewingHistory(false);
      })
      .catch(() => {});
  };

  const handleBackToLatest = () => {
    setMessages(allMessages);
    setViewingHistory(false);
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data) => {
        const sessions = data.sessions ?? [];
        if (sessions.length > 0) setSessionId(sessions[0].id);
      })
      .catch(() => {});
  };

  const handleNewSession = async () => {
    try {
      const n = (allMessages?.length || 0) + 1;
      const res = await fetch("/api/session/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Chat " + n }),
      });
      const data = await res.json();
      if (data.session) {
        setSessionId(data.session.id);
        setMessages([]);
        setViewingHistory(false);
      }
    } catch {}
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);
    setStreamText("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) throw new Error("Chat failed");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let agentContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              switch (event.type) {
                case "text":
                  agentContent += event.content;
                  setStreamText(agentContent);
                  break;
                case "tool_call":
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: crypto.randomUUID(),
                      role: "tool",
                      content: event.data?.result ?? "",
                      toolName: event.data?.name,
                      timestamp: Date.now(),
                    },
                  ]);
                  break;
                case "token":
                  triggerTokenRefresh();
                  break;
                case "error":
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: crypto.randomUUID(),
                      role: "error",
                      content: event.message,
                      timestamp: Date.now(),
                    },
                  ]);
                  break;
                case "done":
                  if (agentContent) {
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        role: "agent",
                        content: agentContent,
                        timestamp: Date.now(),
                      },
                    ]);
                  }
                  setStreamText("");
                  break;
              }
            } catch {
              /* skip malformed */
            }
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "error",
          content: err.message,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="chat-container"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 60px)",
        maxWidth: 800,
        margin: "0 auto",
      }}
    >
      {/* Session error banner */}
      {sessionError && (
        <div
          style={{
            padding: "12px 16px",
            background: "#fef2f2",
            color: "#dc2626",
            fontSize: 13,
            textAlign: "center",
            borderBottom: "1px solid #fecaca",
          }}
        >
          ⚠️ Session expired.{" "}
          <a
            href="/"
            style={{ color: "#dc2626", fontWeight: 600, cursor: "pointer" }}
            onClick={() => window.location.reload()}
          >
            Refresh page
          </a>{" "}
          to re-login.
        </div>
      )}
      {/* Chat header */}
      <div
        className="chat-header"
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #e5e5e5",
          background: "#fff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontWeight: 600 }}>Agent: {agentSlug}</span>
        <div
          className="chat-header-btns"
          style={{ display: "flex", alignItems: "center", gap: 12 }}
        >
          {viewingHistory && (
            <button
              onClick={handleBackToLatest}
              style={{
                padding: "6px 12px",
                background: "#f3f4f6",
                color: "#374151",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              ← Back to latest
            </button>
          )}
          <TokenBar />
          <HistoryPanel
            activeSessionId={sessionId ?? undefined}
            onSelect={handleSelectHistory}
            onNew={handleNewSession}
          />
          <ToolRequestButton />
          <SoulRequestButton />
          <MemoryPanel />
        </div>
      </div>

      {/* Messages */}
      <div
        className="chat-messages"
        style={{ flex: 1, overflow: "auto", padding: 16 }}
      >
        {/* Loading skeleton */}
        {loadingHistory && (
          <div style={{ padding: "16px 0" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ marginBottom: 20 }}>
                <div
                  className="skeleton skeleton-line"
                  style={{
                    width: i % 2 === 0 ? "70%" : "50%",
                    marginLeft: i % 2 === 0 ? "auto" : 0,
                  }}
                />
                <div
                  className="skeleton skeleton-line"
                  style={{
                    width: i % 2 === 0 ? "40%" : "60%",
                    marginLeft: i % 2 === 0 ? "auto" : 0,
                  }}
                />
                <div
                  className="skeleton skeleton-line"
                  style={{
                    width: i % 2 === 0 ? "25%" : "35%",
                    marginLeft: i % 2 === 0 ? "auto" : 0,
                  }}
                />
              </div>
            ))}
          </div>
        )}
        {/* Empty state */}
        {!loadingHistory && messages.length === 0 && !streamText && (
          <div className="empty-state">
            <div className="empty-state-icon">💬</div>
            <div className="empty-state-title">No messages yet</div>
            <div className="empty-state-desc">
              Start a conversation with {agentSlug}! Type a message below.
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} style={{ marginBottom: 16 }}>
            {msg.role === "user" && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div
                  className="chat-message-user"
                  style={{
                    background: "#2563eb",
                    color: "#fff",
                    padding: "10px 16px",
                    borderRadius: 12,
                    maxWidth: "80%",
                    fontSize: 14,
                  }}
                >
                  {msg.content}
                </div>
              </div>
            )}
            {msg.role === "agent" && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  className="chat-message-agent"
                  style={{
                    background: "#f3f4f6",
                    padding: "10px 16px",
                    borderRadius: 12,
                    maxWidth: "80%",
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  <Markdown text={msg.content} />
                </div>
              </div>
            )}
            {msg.role === "tool" && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    background: "#fef3c7",
                    border: "1px solid #f59e0b",
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "#92400e",
                  }}
                >
                  🔧 {msg.toolName}: {msg.content.slice(0, 100)}
                </div>
              </div>
            )}
            {msg.role === "error" && (
              <div style={{ display: "flex", justifyContent: "center" }}>
                <div
                  style={{
                    background: "#fef2f2",
                    color: "#dc2626",
                    padding: "8px 12px",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                >
                  ⚠️ {msg.content}
                </div>
              </div>
            )}
          </div>
        ))}
        {streamText && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-start",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                background: "#f3f4f6",
                padding: "10px 16px",
                borderRadius: 12,
                maxWidth: "80%",
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              <Markdown text={streamText} />
              <span
                style={{
                  animation: "blink 1s infinite",
                  display: "inline-block",
                  marginLeft: 2,
                }}
              >
                ▍
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="chat-input-area"
        style={{
          padding: 12,
          borderTop: "1px solid #e5e5e5",
          background: "#fff",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ketik pesan... (Enter kirim, Shift+Enter baris baru)"
            disabled={streaming}
            rows={2}
            style={{
              flex: 1,
              padding: "10px 12px",
              border: "1px solid #ddd",
              borderRadius: 8,
              fontSize: 14,
              resize: "none",
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={handleSend}
            disabled={streaming || !input.trim()}
            style={{
              padding: "10px 20px",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: streaming ? "wait" : "pointer",
              fontSize: 14,
              fontWeight: 600,
              opacity: !input.trim() || streaming ? 0.5 : 1,
            }}
          >
            {streaming ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Simple inline markdown renderer */
function Markdown({ text }: { text: string }) {
  const html = text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(
      /`(.+?)`/g,
      '<code style="background:#e5e5e5;padding:1px 4px;border-radius:3px;font-size:13px">$1</code>',
    )
    .replace(/\n/g, "<br/>");
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
