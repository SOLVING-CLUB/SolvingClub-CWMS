import { useState } from "react";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { fb } from "../firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThemeToggle } from "../ui/ThemeToggle";
import { BrandLogo } from "../ui/BrandLogo";
import { PasswordInput } from "../ui/PasswordInput";

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

function hasValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setMessage(null); setBusy(true);
    const cleanEmail = normalizedEmail(email);
    if (!hasValidEmail(cleanEmail)) {
      setError("Enter a valid email address.");
      setBusy(false);
      return;
    }
    if (!password) {
      setError("Enter your password to sign in.");
      setBusy(false);
      return;
    }
    try {
      await signInWithEmailAndPassword(fb.auth, cleanEmail, password);
    } catch {
      setError("That email or password doesn't match our records.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    setError(null); setMessage(null);
    const cleanEmail = normalizedEmail(email);
    if (!cleanEmail) { setError("Enter your email address first."); return; }
    if (!hasValidEmail(cleanEmail)) { setError("Enter a valid email address first."); return; }
    setBusy(true);
    try {
      await sendPasswordResetEmail(fb.auth, cleanEmail);
      setMessage("Password reset instructions have been sent if that account exists.");
    } catch {
      setError("We couldn't send a reset email. Check the address and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-screen">
      <div className="login-brand"><BrandLogo /></div>
      <div className="fixed right-5 top-5"><ThemeToggle compact /></div>
      <div className="login-grid">
      <div className="login-intro">
        <img className="login-art" src="/assets/solvingclub-workflow-hero.png" alt="Abstract connected workspace system" />
        <div className="login-art-shade" />
        <span className="login-kicker">Client operations</span>
        <h1>Every engagement,<br />on one calm surface.</h1>
        <p>Track client work, tasks, documents, conversations, and billing without losing the thread.</p>
        <div className="login-metrics"><div><strong>01</strong><span>Clients</span></div><div><strong>02</strong><span>Delivery</span></div><div><strong>03</strong><span>Billing</span></div></div>
      </div>
      <Card className="login-card w-full max-w-md">
        <CardHeader className="gap-3 border-b pb-5">
          <div className="login-product-label">Workspace access</div>
          <div>
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>Sign in to manage clients, work, and billing.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <div className="grid gap-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="you@company.com" value={email} autoComplete="username" maxLength={254} aria-invalid={Boolean(error && !hasValidEmail(normalizedEmail(email)))} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="grid gap-2"><div className="login-field-heading"><Label htmlFor="password">Password</Label><Button type="button" variant="link" size="sm" isDisabled={busy} onPress={resetPassword}>Forgot password?</Button></div><PasswordInput id="password" value={password} autoComplete="current-password" maxLength={1024} aria-invalid={Boolean(error && !password)} toggleDisabled={busy} onChange={(e) => setPassword(e.target.value)} /></div>
            <Button type="submit" className="w-full" isDisabled={busy}>{busy ? "Please wait…" : "Sign in"}</Button>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            {message && <Alert><AlertDescription>{message}</AlertDescription></Alert>}
          </form>
        </CardContent>
      </Card>
      </div>
    </main>
  );
}
