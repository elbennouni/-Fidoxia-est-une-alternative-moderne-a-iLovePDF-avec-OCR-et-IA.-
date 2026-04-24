import { NextRequest } from "next/server";
import { loginSchema } from "@/lib/schemas";
import { comparePassword, createSessionToken, setSessionCookie } from "@/lib/auth";
import { badRequest, ok, serverError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest("Payload de connexion invalide.", parsed.error.flatten());
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
    });

    if (!user) {
      return badRequest("Identifiants invalides.");
    }

    const valid = await comparePassword(parsed.data.password, user.passwordHash);
    if (!valid) {
      return badRequest("Identifiants invalides.");
    }

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });
    await setSessionCookie(token);

    return ok({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    return serverError("Echec de connexion.", error);
  }
}
