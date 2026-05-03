import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractId(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("admin-api-keys");
  return idx !== -1 && parts[idx + 1] && parts[idx + 1] !== "credits-summary"
    ? parts[idx + 1]
    : null;
}

async function getUserIdFromAuth(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );

  const token = authHeader.replace("Bearer ", "");
  const { data } = await supabaseAuth.auth.getUser(token);
  return data?.user?.id ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const id = extractId(url.pathname);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // GET /admin-api-keys/credits-summary — returns credits for the authenticated user
    if (req.method === "GET" && url.pathname.endsWith("/credits-summary")) {
      const userId = await getUserIdFromAuth(req);
      let query = supabase.from("api_keys").select("credits");
      if (userId) {
        query = query.eq("user_id", userId);
      }
      const { data, error } = await query;

      if (error) return jsonResponse({ error: error.message }, 500);

      const total = (data || []).reduce((sum: number, k: { credits: number }) => sum + (k.credits || 0), 0);
      return jsonResponse({ total });
    }

    // All other endpoints require authentication
    const userId = await getUserIdFromAuth(req);
    if (!userId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // GET /admin-api-keys — list user's keys
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("api_keys")
        .select("id, name, key, is_active, usage_count, credits, last_used_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) return jsonResponse({ error: error.message }, 500);

      const masked = (data || []).map((k: Record<string, unknown>) => ({
        ...k,
        key: String(k.key).slice(0, 8) + "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" + String(k.key).slice(-4),
      }));

      return jsonResponse({ data: masked });
    }

    // POST /admin-api-keys — create key for this user
    if (req.method === "POST") {
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return jsonResponse({ error: "Invalid JSON" }, 400);
      }

      const { name, key, credits } = body;
      if (!key || !String(key).trim()) {
        return jsonResponse({ error: "key is required" }, 400);
      }

      const { data, error } = await supabase
        .from("api_keys")
        .insert({
          name: String(name || "Unnamed Key").trim(),
          key: String(key).trim(),
          credits: typeof credits === "number" ? credits : 0,
          user_id: userId,
        })
        .select("id, name, is_active, usage_count, credits, created_at")
        .single();

      if (error) return jsonResponse({ error: error.message }, 500);

      return jsonResponse({ data }, 201);
    }

    // PUT /admin-api-keys/:id — update user's key
    if (req.method === "PUT") {
      if (!id) return jsonResponse({ error: "ID required for PUT" }, 400);

      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return jsonResponse({ error: "Invalid JSON" }, 400);
      }

      const updates: Record<string, unknown> = {};
      if (typeof body.is_active === "boolean") updates.is_active = body.is_active;
      if (typeof body.name === "string" && String(body.name).trim()) updates.name = String(body.name).trim();
      if (typeof body.key === "string" && String(body.key).trim()) updates.key = String(body.key).trim();
      if (typeof body.credits === "number" && !isNaN(body.credits)) updates.credits = body.credits;

      const { data, error } = await supabase
        .from("api_keys")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .select("id, name, is_active, usage_count, credits, last_used_at, created_at")
        .single();

      if (error) return jsonResponse({ error: error.message }, 500);

      return jsonResponse({ data });
    }

    // DELETE /admin-api-keys/:id — delete user's key
    if (req.method === "DELETE") {
      if (!id) return jsonResponse({ error: "ID required for DELETE" }, 400);

      const { error } = await supabase
        .from("api_keys")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) return jsonResponse({ error: error.message }, 500);

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
