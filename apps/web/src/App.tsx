import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { fb } from "./firebase";
import { LoginPage } from "./auth/LoginPage";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => onAuthStateChanged(fb.auth, (u) => { setUser(u); setReady(true); }), []);

  if (!ready) return <p>Loading…</p>;
  if (!user) return <LoginPage />;
  return (
    <div>
      <p>Signed in as {user.email}</p>
      <button onClick={() => signOut(fb.auth)}>Sign out</button>
    </div>
  );
}
