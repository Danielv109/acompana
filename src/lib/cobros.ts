import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { env } from "./env";
import type { Db } from "./db/client";
import { familias } from "./db/schema";

export const DIAS_DE_PRUEBA = 14;

export function stripeConfigurado(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!stripe) stripe = new Stripe(env.stripeKey);
  return stripe;
}

/** Página de pago de Stripe con 14 días gratis. El cobro empieza solo al día 15. */
export async function crearPago(familia: typeof familias.$inferSelect): Promise<string> {
  const sesion = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer_email: familia.email,
    line_items: [{ price: env.stripePrecio(familia.plan, familia.moneda), quantity: 1 }],
    subscription_data: { trial_period_days: DIAS_DE_PRUEBA, metadata: { familiaId: familia.id } },
    metadata: { familiaId: familia.id },
    locale: "es-419",
    allow_promotion_codes: true,
    success_url: `${env.appUrl}/gracias?listo=1`,
    cancel_url: `${env.appUrl}/alta?pago=cancelado`,
  });
  if (!sesion.url) throw new Error("Stripe no devolvió la página de pago.");
  return sesion.url;
}

/** Portal donde la familia cambia de tarjeta, de plan o cancela, sin tener que pedírnoslo. */
export async function crearPortal(customerId: string): Promise<string> {
  const portal = await getStripe().billingPortal.sessions.create({ customer: customerId, return_url: `${env.appUrl}` });
  return portal.url;
}

export function estadoDesdeStripe(status: Stripe.Subscription.Status): typeof familias.$inferSelect["estado"] {
  switch (status) {
    case "trialing": return "prueba";
    case "active":
    case "past_due": return "activa"; // en past_due Stripe reintenta el cobro; no dejamos sola a la mamá de golpe
    case "paused": return "pausada";
    default: return "cancelada";
  }
}

export async function aplicarSuscripcion(db: Db, sub: Stripe.Subscription) {
  const familiaId = sub.metadata?.familiaId;
  if (!familiaId) return;
  await db.update(familias).set({
    estado: estadoDesdeStripe(sub.status),
    stripeSubscriptionId: sub.id,
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    pruebaTerminaEn: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
  }).where(eq(familias.id, familiaId));
}
