export function ok<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

export function created<T>(data: T): Response {
  return Response.json(data, { status: 201 });
}

export function badRequest(message: string, details?: unknown): Response {
  return Response.json({ error: message, details }, { status: 400 });
}

export function unauthorized(message = "Unauthorized"): Response {
  return Response.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden"): Response {
  return Response.json({ error: message }, { status: 403 });
}

export function notFound(message = "Not found"): Response {
  return Response.json({ error: message }, { status: 404 });
}

export function serverError(message = "Internal server error", details?: unknown): Response {
  const safeDetails =
    details instanceof Error
      ? { message: details.message }
      : details;
  return Response.json({ error: message, details: safeDetails }, { status: 500 });
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
