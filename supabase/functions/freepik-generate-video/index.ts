import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MODEL_ENDPOINTS: Record<string, string> = {
  "kling-v2-6-motion-control-std": "/v1/ai/video/kling-v2-6-motion-control-std",
  "kling-v2-6-motion-control-pro": "/v1/ai/video/kling-v2-6-motion-control-pro",
  "kling-v3-motion-control-std": "/v1/ai/video/kling-v3-motion-control-std",
  "kling-v3-motion-control-pro": "/v1/ai/video/kling-v3-motion-control-pro",
};

const POLL_ENDPOINTS: Record<string, string> = {
  "kling-v2-6-motion-control-std": "/v1/ai/image-to-video/kling-v2-6",
  "kling-v2-6-motion-control-pro": "/v1/ai/image-to-video/kling-v2-6",
  "kling-v3-motion-control-std": "/v1/ai/video/kling-v3-motion-control-std",
  "kling-v3-motion-control-pro": "/v1/ai/video/kling-v3-motion-control-pro",
};

const CREDITS_PER_SECOND: Record<string, number> = {
  "kling-v2-6-motion-control-std": 0.059,
  "kling-v2-6-motion-control-pro": 0.118,
  "kling-v3-motion-control-std": 0.126,
  "kling-v3-motion-control-pro": 0.168,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, unknown> = {};

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else {
      try { body = await req.json(); } catch { /* ignore */ }
    }

    const {
      model = "kling-v2-6-motion-control-std",
      prompt = "",
      image_url,
      video_url,
      character_orientation = "video",
      keep_original_sound = false,
      cfg_scale = 0.5,
      user_id = "",
    } = body as Record<string, unknown>;

    const modelSlug = String(model);
    const endpoint = MODEL_ENDPOINTS[modelSlug];

    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: `Unknown model: ${modelSlug}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!image_url) {
      return new Response(
        JSON.stringify({ error: "image_url is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!video_url) {
      return new Response(
        JSON.stringify({ error: "video_url is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Pick least-used active key for this user
    let keyQuery = supabase
      .from("api_keys")
      .select("id, key")
      .eq("is_active", true)
      .order("usage_count", { ascending: true })
      .limit(1);

    if (user_id) {
      keyQuery = keyQuery.eq("user_id", String(user_id));
    }

    const { data: keyRow, error: keyError } = await keyQuery.maybeSingle();

    if (keyError || !keyRow) {
      return new Response(
        JSON.stringify({ error: "No active API keys available. Please add a Freepik API key in your API Keys settings." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requestBody: Record<string, unknown> = {
      image_url,
      video_url,
      character_orientation,
      cfg_scale,
    };

    if (prompt) requestBody.prompt = String(prompt).slice(0, 2500);

    const freepikRes = await fetch(`https://api.freepik.com${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-freepik-api-key": keyRow.key,
      },
      body: JSON.stringify(requestBody),
    });

    const freepikData = await freepikRes.json();

    if (!freepikRes.ok) {
      return new Response(
        JSON.stringify({ error: freepikData?.message || freepikData?.error || "Freepik API error", details: freepikData }),
        { status: freepikRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString(), usage_count: supabase.rpc("increment", { x: 1 }) })
      .eq("id", keyRow.id);

    const taskId = freepikData?.data?.task_id || freepikData?.task_id || null;
    const pollEndpointBase = POLL_ENDPOINTS[modelSlug];

    return new Response(
      JSON.stringify({
        task_id: taskId,
        key_id: keyRow.id,
        model: modelSlug,
        poll_endpoint: pollEndpointBase,
        credits_per_second: CREDITS_PER_SECOND[modelSlug],
        raw: freepikData,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
