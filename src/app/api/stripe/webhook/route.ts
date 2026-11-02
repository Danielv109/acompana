import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { getDb } from "@/lib/db/client";
import { aplicarSuscripcion, getStripe } from "@/lib/cobros";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const cuerpo = await req.text();
  let evento: Stripe.Event;
  try {
    evento = getStripe().webhooks.constructEvent(cuerpo, req.headers.get("stripe-signature") ?? "", env.stripeWebhookSecret);
  } catch {
    return new Response("Firma de Stripe inválida", { status: 400 });
  }
  const db = getDb();
  switch (evento.type) {
    case "checkout.session.completed": {
      const sesion = evento.data.object;
      if (sesion.subscription) {
        const id = typeof sesion.subscription === "string" ? sesion.subscription : sesion.subscription.id;
        await aplicarSuscripcion(db, await getStripe().subscriptions.retrieve(id));
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await aplicarSuscripcion(db, evento.data.object);
      break;
  }
  return NextResponse.json({ recibido: true });
}
