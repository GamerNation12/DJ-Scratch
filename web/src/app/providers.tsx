"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type User = {
  id: string;
  name: string;
  email: string;
  image: string;
};

type SessionContextType = {
  data: { user: User } | null;
  status: "loading" | "authenticated" | "unauthenticated";
  token: string | null;
  logout: () => void;
};

const SessionContext = createContext<SessionContextType>({
  data: null,
  status: "loading",
  token: null,
  logout: () => {},
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<{ user: User } | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const handleAuth = async () => {
      // Check hash for token
      if (typeof window !== "undefined") {
        // Hash processing moved to /logging-in page

        const storedToken = localStorage.getItem("discord_jwt");
        if (storedToken) {
          setToken(storedToken);
          // Decode token payload (JWT is base64Url encoded)
          try {
            const base64Str = storedToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
            const payload = JSON.parse(atob(base64Str));
            setSession({ user: payload });
            setStatus("authenticated");
          } catch (e) {
            console.error("Invalid token", e);
            localStorage.removeItem("discord_jwt");
            setStatus("unauthenticated");
          }
        } else {
          setStatus("unauthenticated");
        }
      }
    };

    handleAuth();
  }, []);

  const logout = () => {
    localStorage.removeItem("discord_jwt");
    setToken(null);
    setSession(null);
    setStatus("unauthenticated");
    window.location.href = "/";
  };

  return (
    <SessionContext.Provider value={{ data: session, status, token, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
