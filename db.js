import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export const LANGS = ["sq", "mk", "en"];
const LOGO_BUCKET = "logos";

// ---------- read helpers ----------

function companyTranslationsToI18n(rows) {
  const i18n = Object.fromEntries(LANGS.map((l) => [l, { tagline: "", location: "", footerNote: "" }]));
  for (const row of rows || []) {
    if (!LANGS.includes(row.language)) continue;
    i18n[row.language] = {
      tagline: row.tagline || "",
      location: row.location || "",
      footerNote: row.footer_note || "",
    };
  }
  return i18n;
}

function linkTranslationsToI18n(rows) {
  const i18n = Object.fromEntries(LANGS.map((l) => [l, { title: "", subtitle: "" }]));
  for (const row of rows || []) {
    if (!LANGS.includes(row.language)) continue;
    i18n[row.language] = { title: row.title || "", subtitle: row.subtitle || "" };
  }
  return i18n;
}

function serviceTranslationsToI18n(rows) {
  const i18n = Object.fromEntries(LANGS.map((l) => [l, { text: "" }]));
  for (const row of rows || []) {
    if (!LANGS.includes(row.language)) continue;
    i18n[row.language] = { text: row.text || "" };
  }
  return i18n;
}

async function getCompanyRow() {
  const { data, error } = await supabase.from("company").select("id").order("id", { ascending: true }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getContent() {
  const { data, error } = await supabase
    .from("company")
    .select(
      `id, name, name_sub, site_url, logo,
       company_translations ( language, tagline, location, footer_note ),
       links ( id, icon, url, is_primary, link_translations ( language, title, subtitle ) ),
       services ( id, icon, service_translations ( language, text ) )`
    )
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    name: data.name || "",
    nameSub: data.name_sub || "",
    siteUrl: data.site_url || "",
    logo: data.logo || "",
    i18n: companyTranslationsToI18n(data.company_translations),
    links: (data.links || [])
      .sort((a, b) => a.id - b.id)
      .map((l) => ({
        icon: l.icon || "",
        url: l.url || "",
        primary: Boolean(l.is_primary),
        i18n: linkTranslationsToI18n(l.link_translations),
      })),
    services: (data.services || [])
      .sort((a, b) => a.id - b.id)
      .map((s) => ({
        icon: s.icon || "",
        i18n: serviceTranslationsToI18n(s.service_translations),
      })),
  };
}

// ---------- write helpers ----------

export async function saveContent(payload) {
  const company = await getCompanyRow();
  if (!company) throw new Error("No company row found — run the seed script first.");
  const companyId = company.id;

  const { error: updateErr } = await supabase
    .from("company")
    .update({
      name: payload.name || "",
      name_sub: payload.nameSub || "",
      site_url: payload.siteUrl || "",
    })
    .eq("id", companyId);
  if (updateErr) throw updateErr;

  const translationRows = LANGS.map((lang) => ({
    company_id: companyId,
    language: lang,
    tagline: payload.i18n?.[lang]?.tagline || "",
    location: payload.i18n?.[lang]?.location || "",
    footer_note: payload.i18n?.[lang]?.footerNote || "",
  }));
  const { error: transErr } = await supabase
    .from("company_translations")
    .upsert(translationRows, { onConflict: "company_id,language" });
  if (transErr) throw transErr;

  const { error: delLinksErr } = await supabase.from("links").delete().eq("company_id", companyId);
  if (delLinksErr) throw delLinksErr;

  for (const link of payload.links || []) {
    const { data: inserted, error: insErr } = await supabase
      .from("links")
      .insert({
        company_id: companyId,
        icon: link.icon || "",
        url: link.url || "#",
        is_primary: Boolean(link.primary),
      })
      .select("id")
      .single();
    if (insErr) throw insErr;

    const rows = LANGS.map((lang) => ({
      link_id: inserted.id,
      language: lang,
      title: link.i18n?.[lang]?.title || "",
      subtitle: link.i18n?.[lang]?.subtitle || "",
    }));
    const { error: tErr } = await supabase.from("link_translations").insert(rows);
    if (tErr) throw tErr;
  }

  const { error: delServicesErr } = await supabase.from("services").delete().eq("company_id", companyId);
  if (delServicesErr) throw delServicesErr;

  const services = (payload.services || []).filter((s) => LANGS.some((lang) => s.i18n?.[lang]?.text));
  for (const service of services) {
    const { data: inserted, error: insErr } = await supabase
      .from("services")
      .insert({ company_id: companyId, icon: service.icon || "" })
      .select("id")
      .single();
    if (insErr) throw insErr;

    const rows = LANGS.map((lang) => ({
      service_id: inserted.id,
      language: lang,
      text: service.i18n?.[lang]?.text || "",
    }));
    const { error: tErr } = await supabase.from("service_translations").insert(rows);
    if (tErr) throw tErr;
  }

  return getContent();
}

export async function updateLogo(logoUrl) {
  const company = await getCompanyRow();
  if (!company) throw new Error("No company row found.");
  const { error } = await supabase.from("company").update({ logo: logoUrl }).eq("id", company.id);
  if (error) throw error;
}

export async function updateSiteUrl(url) {
  const company = await getCompanyRow();
  if (!company) throw new Error("No company row found.");
  const { error } = await supabase.from("company").update({ site_url: url }).eq("id", company.id);
  if (error) throw error;
}

// ---------- storage (logo file uploads) ----------

export async function ensureLogoBucket() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  if (!buckets.some((b) => b.name === LOGO_BUCKET)) {
    const { error: createErr } = await supabase.storage.createBucket(LOGO_BUCKET, { public: true });
    if (createErr) throw createErr;
  }
}

export async function uploadLogoFile(buffer, filename, contentType) {
  const { error: uploadErr } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(filename, buffer, { contentType, upsert: true });
  if (uploadErr) throw uploadErr;
  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(filename);
  return `${data.publicUrl}?v=${Date.now()}`;
}
