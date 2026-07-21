import express from "express";
import cookieParser from "cookie-parser";
import multer from "multer";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import "dotenv/config";
import * as db from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;
const PORT = process.env.PORT || 4173;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

if (!ADMIN_PASSWORD || !SESSION_SECRET) {
  console.error("Missing ADMIN_PASSWORD or SESSION_SECRET in .env — copy .env.example to .env and fill it in.");
  process.exit(1);
}

const app = express();
app.disable("x-powered-by");
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

// ---------- session helpers ----------

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const hmac = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return `${body}.${hmac}`;
}

function verify(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, hmac] = token.split(".");
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  const a = Buffer.from(hmac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function passwordMatches(candidate) {
  if (typeof candidate !== "string" || !candidate) return false;
  const a = crypto.createHash("sha256").update(candidate).digest();
  const b = crypto.createHash("sha256").update(ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

function requireAuth(req, res, next) {
  const payload = verify(req.cookies?.session);
  if (!payload) return res.status(401).json({ error: "Kërkohet identifikim." });
  next();
}

// ---------- content sanitizing ----------

const LANGS = db.LANGS;

function sanitizeContent(input, previous) {
  const str = (v, fallback = "") => (typeof v === "string" ? v.trim() : fallback);

  function sanitizeI18n(inputI18n, previousI18n, fields) {
    const result = {};
    for (const lang of LANGS) {
      const inLang = (inputI18n && inputI18n[lang]) || {};
      const prevLang = (previousI18n && previousI18n[lang]) || {};
      result[lang] = {};
      for (const field of fields) {
        result[lang][field] = str(inLang[field], prevLang[field]);
      }
    }
    return result;
  }

  const links = Array.isArray(input.links)
    ? input.links
        .filter((l) => l && (str(l.url) || LANGS.some((lang) => str((l.i18n || {})[lang]?.title))))
        .map((l) => ({
          icon: str(l.icon),
          url: str(l.url, "#"),
          primary: Boolean(l.primary),
          i18n: sanitizeI18n(l.i18n, {}, ["title", "subtitle"]),
        }))
    : previous.links;

  const services = Array.isArray(input.services)
    ? input.services
        .map((s) => ({
          icon: str(s.icon),
          i18n: sanitizeI18n(s.i18n, {}, ["text"]),
        }))
        .filter((s) => LANGS.some((lang) => s.i18n[lang].text))
    : previous.services;

  return {
    name: str(input.name, previous.name),
    nameSub: str(input.nameSub, previous.nameSub),
    siteUrl: str(input.siteUrl, previous.siteUrl),
    i18n: sanitizeI18n(input.i18n, previous.i18n, ["tagline", "location", "footerNote"]),
    links,
    services,
  };
}

// ---------- auth routes ----------

app.post("/api/login", (req, res) => {
  const { password } = req.body || {};
  if (!passwordMatches(password)) {
    return res.status(401).json({ error: "Fjalëkalim i gabuar." });
  }
  const token = sign({ exp: Date.now() + SESSION_TTL_MS });
  res.cookie("session", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_TTL_MS,
  });
  res.json({ ok: true });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("session");
  res.json({ ok: true });
});

app.get("/api/check-auth", (req, res) => {
  res.json({ authenticated: Boolean(verify(req.cookies?.session)) });
});

// ---------- content routes ----------

app.get("/api/content", async (req, res) => {
  try {
    const content = await db.getContent();
    if (!content) return res.status(404).json({ error: "Nuk u gjet asnjë kompani në bazën e të dhënave." });
    res.json(content);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Nuk mund të lexohet përmbajtja." });
  }
});

app.put("/api/content", requireAuth, async (req, res) => {
  try {
    const previous = await db.getContent();
    if (!previous) return res.status(404).json({ error: "Nuk u gjet asnjë kompani në bazën e të dhënave." });
    const sanitized = sanitizeContent(req.body || {}, previous);
    const saved = await db.saveContent(sanitized);
    res.json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ruajtja dështoi." });
  }
});

// ---------- logo upload ----------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Lloji i skedarit nuk pranohet."), ok);
  },
});

app.post("/api/upload-logo", requireAuth, upload.single("logo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Nuk ka skedar." });
  try {
    const ext = { "image/png": "png", "image/jpeg": "jpg", "image/svg+xml": "svg", "image/webp": "webp" }[
      req.file.mimetype
    ];
    const filename = `logo-${Date.now()}.${ext}`;
    const publicUrl = await db.uploadLogoFile(req.file.buffer, filename, req.file.mimetype);
    await db.updateLogo(publicUrl);
    res.json({ logo: publicUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ngarkimi dështoi." });
  }
});

// ---------- QR code (generated on the fly, no disk writes) ----------

const QR_OPTS = { color: { dark: "#06231a", light: "#f5f1e6" }, margin: 2, width: 800 };

app.get("/api/qr.png", async (req, res) => {
  try {
    const content = await db.getContent();
    const url = content?.siteUrl || "https://example.com";
    const buffer = await QRCode.toBuffer(url, QR_OPTS);
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "no-store");
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

app.get("/api/qr.svg", async (req, res) => {
  try {
    const content = await db.getContent();
    const url = content?.siteUrl || "https://example.com";
    const svg = await QRCode.toString(url, { ...QR_OPTS, type: "svg" });
    res.set("Content-Type", "image/svg+xml");
    res.set("Cache-Control", "no-store");
    res.send(svg);
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

app.post("/api/regenerate-qr", requireAuth, async (req, res) => {
  const url = typeof req.body?.url === "string" ? req.body.url.trim() : "";
  if (!/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: "URL e pavlefshme (duhet të fillojë me http:// ose https://)." });
  }
  try {
    await db.updateSiteUrl(url);
    res.json({ ok: true, url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Përditësimi i URL-së dështoi." });
  }
});

// ---------- static files (index.html, styles, admin panel, placeholder assets) ----------

app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

app.use((err, req, res, next) => {
  if (!err) return next();
  console.error(err);
  res.status(400).json({ error: err.message || "Gabim gjatë kërkesës." });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Perla Event Lighting running at http://localhost:${PORT}`);
    console.log(`Admin panel at http://localhost:${PORT}/admin`);
  });
}

export default app;
