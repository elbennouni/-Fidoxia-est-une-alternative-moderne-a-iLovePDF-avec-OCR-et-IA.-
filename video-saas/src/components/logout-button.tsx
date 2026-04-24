"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <Button type="button" onClick={handleLogout} variant="secondary">
      Se deconnecter
    </Button>
  );
}
