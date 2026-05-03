import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const VIDEO_POLL_BASES: Record<string, string> = {
  "kling-v2-6-motion-control-std": "/v1/ai/image-to-video/kling-v2-6",
  "kling-v2-6-motion-control-pro": "/v1/ai/image-to-video/kling-v2-6",
  "kling-v3-motion-control-std": "/v1/ai/video/kling-v3-motion-control-std",
  "kling-v3-motion-control-pro": "/v1/ai/video/kling-v3-motion-control-pro",
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

    const reqBody = await req.json();
    let { task_id, history_id, key_id, credit_cost, model } = reqBody;

    if (!task_id) {
      return new Response(
        JSON.stringify({ error: "task_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If key_id / credit_cost not provided, read from history parameters
    if (history_id && (!key_id || !credit_cost)) {
      const { data: histRow } = await supabase
        .from("generation_history")
        .select("parameters")
        .eq("id", history_id)
        .maybeSingle();

      if (histRow?.parameters) {
        const params = histRow.parameters as Record<string, unknown>;
        if (!key_id && params.key_id) key_id = params.key_id;
        if (!credit_cost && params.credit_cost) credit_cost = params.credit_cost;
        if (!model && params.model) model = params.model;
      }
    }

    // Resolve API key
    let apiKey: string | null = null;
    if (key_id) {
      const { data } = await supabase
        .from("api_keys")
        .select("key")
        .eq("id", key_id)
        .maybeSingle();
      apiKey = data?.key ?? null;
    }

    if (!apiKey) {
      const { data: keyRow } = await supabase
        .from("api_keys")
        .select("key")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      apiKey = keyRow?.key ?? null;
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "No active API keys available." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build poll URL
    const modelSlug = String(model || "");
    const videoPollBase = VIDEO_POLL_BASES[modelSlug];

    const pollUrl = videoPollBase
      ? `https://api.freepik.com${videoPollBase}/${task_id}`
      : `https://api.freepik.com/v1/ai/text-to-image/nano-banana-pro/${task_id}`;

    const pollRes = await fetch(pollUrl, {
      method: "GET",
      headers: {
        "x-freepik-api-key": apiKey,
        "Accept-Language": "en-US",
      },
    });

    const pollData = await pollRes.json();

    if (!pollRes.ok) {
      // 404 means task expired or doesn't exist — mark as failed
      if (pollRes.status === 404 && history_id) {
        await supabase
          .from("generation_history")
          .update({ status: "failed", error_message: "Task expired or not found on Freepik", updated_at: new Date().toISOString() })
          .eq("id", history_id);
      }
      return new Response(
        JSON.stringify({ status: "FAILED", error: pollData?.message || "Poll failed", details: pollData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Some endpoints wrap in data{}, others return top-level
    const dataObj = pollData?.data || pollData || {};
    const status: string = dataObj?.status || "IN_PROGRESS";

    // Result URL: data.generated[0] (image & motion control video both use this)
    const generated: string[] = dataObj?.generated || [];
    const resultUrl: string | null = generated[0] || null;

    if (history_id) {
      const normalizedStatus = status.toUpperCase();
      if (normalizedStatus === "COMPLETED" && resultUrl) {
        // Only update and deduct credits if not already completed (prevent double deduction)
        const { data: currentRow } = await supabase
          .from("generation_history")
          .select("status")
          .eq("id", history_id)
          .maybeSingle();

        if (currentRow && currentRow.status !== "completed") {
          await supabase
            .from("generation_history")
            .update({ status: "completed", result_url: resultUrl, updated_at: new Date().toISOString() })
            .eq("id", history_id);

          if (key_id && credit_cost && credit_cost > 0) {
            const { data: keyRow } = await supabase
              .from("api_keys")
              .select("credits")
              .eq("id", key_id)
              .maybeSingle();

            if (keyRow) {
              const newCredits = Math.max(0, (keyRow.credits ?? 0) - credit_cost);
              await supabase
                .from("api_keys")
                .update({ credits: newCredits })
                .eq("id", key_id);
            }
          }
        }
      } else if (normalizedStatus === "FAILED") {
        const errMsg = dataObj?.error || dataObj?.message || "Generation failed on Freepik";
        await supabase
          .from("generation_history")
          .update({ status: "failed", error_message: errMsg, updated_at: new Date().toISOString() })
          .eq("id", history_id);
      }
    }

    return new Response(
      JSON.stringify({ status, result_url: resultUrl, generated, raw: pollData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
