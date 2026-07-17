import { useState, useEffect } from "react";

interface User {
  id: string;
  email: string;
  displayName: string;
  agentSlug: string;
  balance: number;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async () => {
    window.location.href = "https://chat.gezytech.web.id/webchat/";
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  return { user, loading, login, logout };
}
