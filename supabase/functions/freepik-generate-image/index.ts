import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CREDIT_COST: Record<string, number> = {
  "1K": 0.1,
  "2K": 0.15,
  "4K": 0.3,
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let prompt = "";
    let aspect_ratio = "1:1";
    let resolution = "2K";
    let user_id = "";
    const referenceImages: { image: string; mime_type: string }[] = [];

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      prompt = (form.get("prompt") as string) || "";
      aspect_ratio = (form.get("aspect_ratio") as string) || "1:1";
      resolution = (form.get("resolution") as string) || "2K";
      user_id = (form.get("user_id") as string) || "";

      for (const [key, value] of form.entries()) {
        if (key.startsWith("image_") && value instanceof File) {
          const buffer = await value.arrayBuffer();
          const base64 = arrayBufferToBase64(buffer);
          referenceImages.push({
            image: `data:${value.type || "image/jpeg"};base64,${base64}`,
            mime_type: value.type || "image/jpeg",
          });
        }
      }
    } else {
      const body = await req.json();
      prompt = body.prompt || "";
      aspect_ratio = body.aspect_ratio || "1:1";
      resolution = body.resolution || "2K";
      user_id = body.user_id || "";
    }

    if (!prompt || prompt.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: "prompt must be at least 2 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Pick the active key with least usage for this user
    let keyQuery = supabase
      .from("api_keys")
      .select("id, key, usage_count, credits")
      .eq("is_active", true)
      .order("usage_count", { ascending: true })
      .limit(1);

    if (user_id) {
      keyQuery = keyQuery.eq("user_id", user_id);
    }

    const { data: keyRow, error: keyError } = await keyQuery.maybeSingle();

    if (keyError || !keyRow) {
      return new Response(
        JSON.stringify({ error: "No active API keys available. Please add a Freepik API key in your API Keys settings." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const creditCost = CREDIT_COST[resolution] ?? 1;

    const freepikPayload: Record<string, unknown> = {
      prompt: prompt.trim(),
      aspect_ratio,
      resolution,
    };

    if (referenceImages.length > 0) {
      freepikPayload.reference_images = referenceImages.slice(0, 3);
    }

    const freepikRes = await fetch("https://api.freepik.com/v1/ai/text-to-image/nano-banana-pro", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-freepik-api-key": keyRow.key,
        "Accept": "application/json",
        "Accept-Language": "en-US",
      },
      body: JSON.stringify(freepikPayload),
    });

    let freepikData: Record<string, unknown>;
    const rawText = await freepikRes.text();
    try {
      freepikData = JSON.parse(rawText);
    } catch {
      return new Response(
        JSON.stringify({ error: `Freepik returned non-JSON response (HTTP ${freepikRes.status})`, raw: rawText.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!freepikRes.ok) {
      return new Response(
        JSON.stringify({
          error: (freepikData?.message as string) || (freepikData?.error as string) || `Freepik API error (${freepikRes.status})`,
          details: freepikData,
        }),
        { status: freepikRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("api_keys")
      .update({ usage_count: keyRow.usage_count + 1, last_used_at: new Date().toISOString() })
      .eq("id", keyRow.id);

    const taskData = freepikData?.data as Record<string, unknown> | undefined;
    const taskId = taskData?.task_id as string | undefined;

    return new Response(
      JSON.stringify({
        task_id: taskId,
        status: taskData?.status || "CREATED",
        key_id: keyRow.id,
        credit_cost: creditCost,
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
