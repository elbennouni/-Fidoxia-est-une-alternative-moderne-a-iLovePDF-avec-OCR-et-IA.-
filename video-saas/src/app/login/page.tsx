"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, Input, SectionTitle } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Connexion impossible");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <Card>
        <SectionTitle title="Connexion" subtitle="Acces a ton studio AI video" />
        <form onSubmit={submit} className="space-y-3">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input
            label="Mot de passe"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button className="btn-primary w-full" disabled={loading} type="submit">
            {loading ? "Connexion..." : "Se connecter"}
          </button>
          <p className="text-sm text-slate-300">
            Pas encore de compte ?{" "}
            <Link className="text-cyan-300 underline-offset-4 hover:underline" href="/register">
              Cree un compte
            </Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
