// One-time script: loads public/data/content.json (and the current logo file)
// into the Supabase tables. Run with: node scripts/seed-supabase.mjs
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import * as db from "../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_PATH = path.join(__dirname, "..", "public", "data", "content.json");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  const { data: existing, error: existingErr } = await supabase.from("company").select("id").limit(1);
  if (existingErr) throw existingErr;
  if (existing.length > 0) {
    console.log("A company row already exists (id=" + existing[0].id + ") — seed already ran. Aborting.");
    console.log("Delete that row first (cascades to everything) if you want to reseed.");
    return;
  }

  const content = JSON.parse(await fs.readFile(CONTENT_PATH, "utf8"));

  const { data: company, error: insertErr } = await supabase
    .from("company")
    .insert({ name: content.name || "", name_sub: content.nameSub || "" })
    .select("id")
    .single();
  if (insertErr) throw insertErr;
  console.log("Created company row id=" + company.id);

  await db.saveContent({
    name: content.name,
    nameSub: content.nameSub,
    siteUrl: content.siteUrl,
    i18n: content.i18n,
    links: content.links,
    services: content.services,
  });
  console.log("Saved translations, links, and services.");

  if (content.logo) {
    const localPath = path.join(__dirname, "..", "public", content.logo);
    try {
      const buffer = await fs.readFile(localPath);
      const ext = path.extname(content.logo).slice(1) || "png";
      const contentType = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml", webp: "image/webp" }[
        ext
      ] || "image/png";
      const publicUrl = await db.uploadLogoFile(buffer, `logo-seed.${ext}`, contentType);
      await db.updateLogo(publicUrl);
      console.log("Uploaded logo to Supabase Storage:", publicUrl);
    } catch (err) {
      console.warn("Could not upload existing logo file (" + localPath + "):", err.message);
      console.warn("You can upload a new one via /admin instead.");
    }
  }

  console.log("Seed complete.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
