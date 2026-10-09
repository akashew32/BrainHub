const backendBase = (process.env.BACKEND_URL ?? "http://localhost:8000/api").replace(/\/$/, "");

type RouteParams = { params: Promise<{ path: string[] }> };

async function proxy(request: Request, context: RouteParams) {
  const { path } = await context.params;
  const incoming = new URL(request.url);
  const target = `${backendBase}/${path.map(encodeURIComponent).join("/")}${incoming.search}`;
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
    });
    const responseHeaders = new Headers();
    const responseType = response.headers.get("content-type");
    if (responseType) responseHeaders.set("content-type", responseType);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch {
    return Response.json({ detail: "BrainHub API is unavailable" }, { status: 503 });
  }
}

export const dynamic = "force-dynamic";
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
