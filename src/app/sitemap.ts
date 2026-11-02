import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return ["", "/alta", "/privacidad", "/terminos"].map((ruta) => ({ url: `${base}${ruta}`, changeFrequency: "monthly" }));
}
