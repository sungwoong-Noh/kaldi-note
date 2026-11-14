const err = (status, code) => Response.json({ code }, { status });

export default {
  async fetch(request, env) {
    if (request.method !== "GET") return err(405, "RELAY_METHOD_NOT_ALLOWED");
    if (request.headers.get("X-Relay-Token") !== env.RELAY_TOKEN || !env.RELAY_TOKEN)
      return err(401, "RELAY_UNAUTHORIZED");
    let target;
    try {
      target = new URL(new URL(request.url).searchParams.get("url"));
    } catch {
      return err(400, "RELAY_BAD_URL");
    }
    if (target.protocol !== "https:") return err(400, "RELAY_BAD_URL");
    const allowed = env.ALLOWED_HOSTS.split(",").map((h) => h.trim().toLowerCase());
    if (!allowed.includes(target.hostname)) return err(403, "RELAY_HOST_NOT_ALLOWED");
    let upstream;
    try {
      upstream = await fetch(target, {
        headers: { "User-Agent": request.headers.get("User-Agent") ?? "" },
      });
    } catch {
      return err(502, "RELAY_UPSTREAM_FAILED");
    }
    const headers = new Headers();
    const type = upstream.headers.get("Content-Type");
    if (type) headers.set("Content-Type", type);
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
