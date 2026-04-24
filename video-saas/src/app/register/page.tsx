"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Input, PrimaryButton, SecondaryButton } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Echec d'inscription");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Echec d'inscription");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md py-8">
      <Card>
        <h1 className="text-2xl font-semibold">Inscription</h1>
        <p className="mt-2 text-sm text-white/70">
          Cree un compte pour lancer des series IA coherentes.
        </p>
        <form className="mt-4 grid gap-3" onSubmit={onSubmit}>
          <Input
            label="Nom"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            label="Email"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            label="Mot de passe"
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <div className="flex gap-2">
            <PrimaryButton type="submit" disabled={loading}>
              {loading ? "Creation..." : "Creer mon compte"}
            </PrimaryButton>
            <SecondaryButton type="button" onClick={() => router.push("/login")}>
              Aller au login
            </SecondaryButton>
          </div>
        </form>
      </Card>
    </main>
  );
}
