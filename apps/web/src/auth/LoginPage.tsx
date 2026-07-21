import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { fb } from "../firebase";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await signInWithEmailAndPassword(fb.auth, email, password);
    } catch {
      setError("That email or password doesn't match our records.");
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)", padding: 24,
    }}>
      <form onSubmit={onSubmit} className="card" style={{ width: 340 }}>
        <div className="wordmark" style={{ marginBottom: 20 }}>SolvingClub</div>
        <div className="eyebrow">Sign in</div>
        <h1 style={{ fontSize: 18, marginBottom: 18 }}>Client Management System</h1>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input placeholder="Email" value={email} autoComplete="username"
            onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" value={password} autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" style={{ width: "100%", marginTop: 4 }}>Sign in</button>
        </div>

        {error && (
          <p role="alert" style={{
            marginTop: 12, marginBottom: 0, fontSize: 12, color: "var(--danger)",
            background: "var(--danger-wash)", padding: "8px 10px", borderRadius: "var(--radius-sm)",
          }}>
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
