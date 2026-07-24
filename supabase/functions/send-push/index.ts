import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import webpush from "https://esm.sh/web-push@3.6.7";

serve(async (req) => {
  // Configurar CORS
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Obter payload do webhook
    const payload = await req.json();
    console.log("Webhook payload received:", payload);

    if (payload.type !== "INSERT" || payload.table !== "notificacoes") {
      return new Response(JSON.stringify({ error: "Invalid webhook payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { record } = payload;
    const { user_id, mensagem, tipo, metadata } = record;

    if (!user_id || !mensagem) {
      return new Response(JSON.stringify({ error: "Missing user_id or mensagem in record" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Configurar cliente Supabase Admin
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar as subscrições do utilizador
    const { data: subscriptions, error: subsError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", user_id);

    if (subsError) {
      console.error("Error fetching subscriptions:", subsError);
      return new Response(JSON.stringify({ error: "Failed to fetch subscriptions" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No push subscriptions found for user ${user_id}`);
      return new Response(JSON.stringify({ message: "No active subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Configurar Web Push
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY secret");
      return new Response(JSON.stringify({ error: "Missing VAPID configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    webpush.setVapidDetails(
      "mailto:joaquimmulazadev@gmail.com",
      vapidPublicKey,
      vapidPrivateKey
    );

    const notificationPayload = JSON.stringify({
      title: "Nova Notificação",
      body: mensagem,
      icon: "/pwa-192x192.png", // Ícone PWA
      badge: "/pwa-512x512.png",
      data: {
        url: "/", // Fallback URL
        notificationId: record.id,
        metadata: metadata || {}
      }
    });

    // Enviar notificações para todas as subscrições ativas
    const sendPromises = subscriptions.map((sub) => {
      // The push_subscriptions table stores the full object from PushSubscription.toJSON()
      // in the 'subscription' JSONB column.
      const subInfo = sub.subscription;
      return webpush.sendNotification(subInfo, notificationPayload).catch((err) => {
        // Se a subscrição for inválida/expirada, podemos querer eliminá-la (Gane status 410)
        console.error("Error sending push notification to one device:", err);
        if (err.statusCode === 410 || err.statusCode === 404) {
             // Limpeza assíncrona da subscrição inválida
             supabaseAdmin.from('push_subscriptions').delete().eq('subscription', JSON.stringify(subInfo));
        }
      });
    });

    await Promise.allSettled(sendPromises);

    return new Response(JSON.stringify({ success: true, count: subscriptions.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    });
  }
});
