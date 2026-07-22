import { createContext, useContext, type ReactNode } from "react";

export type Session = { role: "owner" | "admin" | "member" | "client"; clientId?: string; uid: string };
const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ value, children }: { value: Session; children: ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside SessionProvider");
  return session;
}

export function canAdmin(role: Session["role"]) { return role === "owner" || role === "admin"; }
