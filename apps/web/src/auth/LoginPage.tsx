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
      setError("Invalid email or password.");
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <h1>SolvingClub — Sign in</h1>
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" value={password}
        onChange={(e) => setPassword(e.target.value)} />
      <button type="submit">Sign in</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
