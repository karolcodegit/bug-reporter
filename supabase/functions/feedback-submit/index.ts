// @ts-nocheck
// ============================================================
// CEEA Feedback Submit — Edge Function (naprawiona wersja)
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SLACK_WEBHOOK_URL = Deno.env.get("SLACK_WEBHOOK_URL");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    console.log("[feedback] START");
    console.log("[feedback] SLACK_WEBHOOK_URL present:", !!SLACK_WEBHOOK_URL);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const body = await req.json();
    console.log("[feedback] Body keys:", Object.keys(body));
    console.log("[feedback] Has screenshot:", !!body.screenshot_base64);
    if (body.screenshot_base64) {
      console.log("[feedback] Screenshot size:", Math.round(body.screenshot_base64.length / 1024), "KB");
    }

    const {
      type,
      title,
      description,
      page_url,
      source,
      screenshot_base64,
      browser_info,
      console_logs,
      reporter_email,
    } = body;

    if (!type || !title || !page_url || !source) {
      return new Response(
        JSON.stringify({ error: "Brak wymaganych pol" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let screenshot_url = null;

    // 1. Zapisz zrzut ekranu do Storage (jeśli jest)
    if (screenshot_base64 && screenshot_base64.startsWith("data:image")) {
      try {
        const base64Data = screenshot_base64.split(",")[1];
        const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
        const fileName = `screenshot-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
        const filePath = `${source}/${fileName}`;

        console.log("[feedback] Uploading screenshot to:", filePath);
        console.log("[feedback] Binary size:", binaryData.length, "bytes");

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("feedback-screenshots")
          .upload(filePath, binaryData, {
            contentType: "image/png",
            upsert: false,
          });

        if (uploadError) {
          console.error("[feedback] Upload error:", uploadError);
        } else {
          screenshot_url = filePath;
          console.log("[feedback] Screenshot uploaded:", screenshot_url);
        }
      } catch (uploadErr) {
        console.error("[feedback] Screenshot processing error:", uploadErr);
      }
    }

    // 2. Zapisz rekord do bazy
    console.log("[feedback] Inserting into feedback_reports");
    console.log("[feedback] Data:", JSON.stringify({
      type, title: title.substring(0, 50), page_url, source, has_screenshot: !!screenshot_url
    }));

    const { data: report, error: dbError } = await supabase
      .from("feedback_reports")
      .insert({
        type,
        title: title.substring(0, 200),
        description: description?.substring(0, 5000) || null,
        page_url: page_url.substring(0, 1000),
        source,
        screenshot_url,
        browser_info: browser_info || {},
        console_logs: console_logs || [],
        reporter_email: reporter_email?.substring(0, 255) || null,
        status: "new",
        priority: "medium",
      })
      .select()
      .single();

    if (dbError) {
      console.error("[feedback] DB error:", dbError);
      return new Response(
        JSON.stringify({ error: "DB error", details: dbError.message, hint: dbError.hint, code: dbError.code }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[feedback] Saved:", report.id);

    // 3. Slack
    if (SLACK_WEBHOOK_URL) {
      try {
        await fetch(SLACK_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `🚨 Nowe zgłoszenie: ${title}\nŹródło: ${source}\nURL: ${page_url}`,
          }),
        });
        console.log("[feedback] Slack OK");
      } catch (e) {
        console.error("[feedback] Slack error:", e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, id: report.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[feedback] FATAL:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", details: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});