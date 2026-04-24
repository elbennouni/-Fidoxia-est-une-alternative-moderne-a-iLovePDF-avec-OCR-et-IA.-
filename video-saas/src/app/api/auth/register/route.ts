import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/schemas";
import { badRequest, parseJsonBody, serverError } from "@/lib/http";
import { createSessionToken, hashPassword, setSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Invalid registration payload", parsed.error.flatten());
    }

    const email = parsed.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return badRequest("Email already in use");
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.user.create({
      data: {
        email,
        name: parsed.data.name,
        passwordHash,
      },
      select: { id: true, email: true, name: true },
    });

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });
    await setSessionCookie(token);

    return Response.json({ user }, { status: 201 });
  } catch (error) {
    return serverError("Unable to register", error);
  }
}
