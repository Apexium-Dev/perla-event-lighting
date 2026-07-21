const LANGS = ["sq", "mk", "en"];
let currentEditLang = "sq";

const loginScreen = document.getElementById("login-screen");
const dashboardScreen = document.getElementById("dashboard-screen");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");

const fields = {
  name: document.getElementById("f-name"),
  nameSub: document.getElementById("f-nameSub"),
  siteUrl: document.getElementById("f-siteUrl"),
};

const linksEditor = document.getElementById("links-editor");
const servicesEditor = document.getElementById("services-editor");
const linkRowTemplate = document.getElementById("link-row-template");
const serviceRowTemplate = document.getElementById("service-row-template");

const loginLogo = document.getElementById("login-logo");
const logoPreview = document.getElementById("logo-preview");
const logoFileInput = document.getElementById("logo-file");
const qrPreview = document.getElementById("qr-preview");
const saveStatus = document.getElementById("save-status");
const toast = document.getElementById("toast");
let toastTimer;

function showToast(text, kind) {
  toast.textContent = text;
  toast.className = "toast" + (kind ? ` ${kind}` : "");
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 2500);
}

function showLogin(message) {
  loginScreen.hidden = false;
  dashboardScreen.hidden = true;
  if (message) {
    loginError.textContent = message;
    loginError.hidden = false;
  }
}

function showDashboard() {
  loginScreen.hidden = true;
  dashboardScreen.hidden = false;
}

function setStatus(text, kind) {
  saveStatus.textContent = text;
  saveStatus.className = "save-status" + (kind ? ` ${kind}` : "");
  if (kind === "ok") {
    setTimeout(() => {
      if (saveStatus.textContent === text) saveStatus.textContent = "";
    }, 2500);
  }
}

// ---------- editing language tabs ----------

function applyLangVisibility(root, lang) {
  root.querySelectorAll("[data-lang]").forEach((el) => {
    el.hidden = el.dataset.lang !== lang;
  });
}

document.querySelectorAll(".edit-lang-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentEditLang = btn.dataset.langTab;
    document.querySelectorAll(".edit-lang-btn").forEach((b) => b.classList.toggle("active", b === btn));
    applyLangVisibility(document, currentEditLang);
  });
});

// ---------- icon picker ----------

function setupIconPicker(row, selectSelector, initialIcon) {
  const select = row.querySelector(selectSelector);
  const preview = row.querySelector(".icon-preview");
  for (const name of ICON_NAMES) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  }
  select.value = ICON_NAMES.includes(initialIcon) ? initialIcon : DEFAULT_ICON;
  preview.replaceChildren(iconElement(select.value));
  select.addEventListener("change", () => {
    preview.replaceChildren(iconElement(select.value));
  });
}

// ---------- link rows ----------

function emptyI18n(fieldNames) {
  return Object.fromEntries(LANGS.map((lang) => [lang, Object.fromEntries(fieldNames.map((f) => [f, ""]))]));
}

function addLinkRow(link = { icon: DEFAULT_ICON, url: "", primary: false, i18n: emptyI18n(["title", "subtitle"]) }) {
  const node = linkRowTemplate.content.firstElementChild.cloneNode(true);
  setupIconPicker(node, ".link-icon", link.icon);
  for (const lang of LANGS) {
    node.querySelector(`.link-title[data-lang="${lang}"]`).value = link.i18n?.[lang]?.title || "";
    node.querySelector(`.link-subtitle[data-lang="${lang}"]`).value = link.i18n?.[lang]?.subtitle || "";
  }
  node.querySelector(".link-url").value = link.url || "";
  node.querySelector(".link-primary").checked = Boolean(link.primary);

  node.querySelector(".move-up").addEventListener("click", () => {
    const prev = node.previousElementSibling;
    if (prev) linksEditor.insertBefore(node, prev);
  });
  node.querySelector(".move-down").addEventListener("click", () => {
    const next = node.nextElementSibling;
    if (next) linksEditor.insertBefore(next, node);
  });
  node.querySelector(".remove").addEventListener("click", () => node.remove());

  linksEditor.appendChild(node);
  applyLangVisibility(node, currentEditLang);
}

function collectLinks() {
  return [...linksEditor.querySelectorAll(".link-row")].map((row) => ({
    icon: row.querySelector(".link-icon").value,
    url: row.querySelector(".link-url").value.trim(),
    primary: row.querySelector(".link-primary").checked,
    i18n: Object.fromEntries(
      LANGS.map((lang) => [
        lang,
        {
          title: row.querySelector(`.link-title[data-lang="${lang}"]`).value.trim(),
          subtitle: row.querySelector(`.link-subtitle[data-lang="${lang}"]`).value.trim(),
        },
      ])
    ),
  }));
}

// ---------- service rows ----------

function addServiceRow(service = { icon: "sparkle", i18n: emptyI18n(["text"]) }) {
  const node = serviceRowTemplate.content.firstElementChild.cloneNode(true);
  setupIconPicker(node, ".service-icon", service.icon);
  for (const lang of LANGS) {
    node.querySelector(`.service-text[data-lang="${lang}"]`).value = service.i18n?.[lang]?.text || "";
  }
  node.querySelector(".remove").addEventListener("click", () => node.remove());
  servicesEditor.appendChild(node);
  applyLangVisibility(node, currentEditLang);
}

function collectServices() {
  return [...servicesEditor.querySelectorAll(".service-row")]
    .map((row) => ({
      icon: row.querySelector(".service-icon").value,
      i18n: Object.fromEntries(
        LANGS.map((lang) => [lang, { text: row.querySelector(`.service-text[data-lang="${lang}"]`).value.trim() }])
      ),
    }))
    .filter((s) => LANGS.some((lang) => s.i18n[lang].text));
}

// ---------- load / populate ----------

function logoDisplayUrl(logo) {
  if (!logo) return "";
  const base = /^https?:\/\//i.test(logo) ? logo : `/${logo}`;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}t=${Date.now()}`;
}

function applyLogo(logoPath) {
  const url = logoDisplayUrl(logoPath);
  logoPreview.src = url;
  loginLogo.src = url;
}

async function loadLoginLogo() {
  try {
    const res = await fetch("/api/content", { cache: "no-store" });
    const data = await res.json();
    if (data.logo) loginLogo.src = logoDisplayUrl(data.logo);
  } catch {
    // keep placeholder logo if this fails
  }
}

async function loadContent() {
  const res = await fetch("/api/content", { cache: "no-store" });
  const data = await res.json();

  fields.name.value = data.name || "";
  fields.nameSub.value = data.nameSub || "";
  fields.siteUrl.value = data.siteUrl || "";

  for (const lang of LANGS) {
    document.querySelector(`.f-tagline[data-lang="${lang}"]`).value = data.i18n?.[lang]?.tagline || "";
    document.querySelector(`.f-location[data-lang="${lang}"]`).value = data.i18n?.[lang]?.location || "";
    document.querySelector(`.f-footerNote[data-lang="${lang}"]`).value = data.i18n?.[lang]?.footerNote || "";
  }

  applyLogo(data.logo);
  qrPreview.src = `/api/qr.png?t=${Date.now()}`;

  linksEditor.innerHTML = "";
  for (const link of data.links || []) addLinkRow(link);

  servicesEditor.innerHTML = "";
  for (const service of data.services || []) addServiceRow(service);

  applyLangVisibility(document, currentEditLang);
}

// ---------- auth ----------

async function checkAuth() {
  const res = await fetch("/api/check-auth");
  const { authenticated } = await res.json();
  if (authenticated) {
    showDashboard();
    loadContent();
  } else {
    showLogin();
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  const password = document.getElementById("password").value;
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (res.ok) {
    document.getElementById("password").value = "";
    showDashboard();
    loadContent();
  } else {
    const { error } = await res.json().catch(() => ({ error: "Diçka shkoi keq." }));
    loginError.textContent = error || "Fjalëkalim i gabuar.";
    loginError.hidden = false;
  }
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  showLogin();
});

// ---------- add buttons ----------

document.getElementById("add-link-btn").addEventListener("click", () => addLinkRow());
document.getElementById("add-service-btn").addEventListener("click", () => addServiceRow());

// ---------- save ----------

async function saveAll() {
  setStatus("Duke ruajtur…");
  const payload = {
    name: fields.name.value,
    nameSub: fields.nameSub.value,
    siteUrl: fields.siteUrl.value,
    i18n: Object.fromEntries(
      LANGS.map((lang) => [
        lang,
        {
          tagline: document.querySelector(`.f-tagline[data-lang="${lang}"]`).value.trim(),
          location: document.querySelector(`.f-location[data-lang="${lang}"]`).value.trim(),
          footerNote: document.querySelector(`.f-footerNote[data-lang="${lang}"]`).value.trim(),
        },
      ])
    ),
    links: collectLinks(),
    services: collectServices(),
  };
  const res = await fetch("/api/content", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.ok) {
    setStatus("U ruajt ✓", "ok");
    showToast("Ndryshimet u ruajtën ✓", "ok");
  } else {
    const { error } = await res.json().catch(() => ({ error: "Ruajtja dështoi." }));
    setStatus(error || "Ruajtja dështoi.", "err");
    showToast(error || "Ruajtja dështoi.", "err");
  }
}

document.getElementById("save-btn").addEventListener("click", saveAll);
document.getElementById("save-btn-top").addEventListener("click", saveAll);

// ---------- logo upload ----------

document.getElementById("logo-upload-btn").addEventListener("click", async () => {
  const file = logoFileInput.files?.[0];
  if (!file) {
    setStatus("Zgjidh një skedar logoje së pari.", "err");
    return;
  }
  setStatus("Duke ngarkuar logon…");
  const formData = new FormData();
  formData.append("logo", file);
  const res = await fetch("/api/upload-logo", { method: "POST", body: formData });
  if (res.ok) {
    const { logo } = await res.json();
    applyLogo(logo);
    logoFileInput.value = "";
    setStatus("Logo u ngarkua ✓", "ok");
    showToast("Logo u ngarkua ✓", "ok");
  } else {
    const { error } = await res.json().catch(() => ({ error: "Ngarkimi dështoi." }));
    setStatus(error || "Ngarkimi dështoi.", "err");
    showToast(error || "Ngarkimi dështoi.", "err");
  }
});

// ---------- QR regenerate ----------

document.getElementById("regen-qr-btn").addEventListener("click", async () => {
  const url = fields.siteUrl.value.trim();
  if (!/^https?:\/\//i.test(url)) {
    setStatus("Vendos një URL të vlefshme (http:// ose https://).", "err");
    return;
  }
  setStatus("Duke rigjeneruar QR-in…");
  const res = await fetch("/api/regenerate-qr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (res.ok) {
    qrPreview.src = `/api/qr.png?t=${Date.now()}`;
    setStatus("QR kodi u rigjenerua ✓", "ok");
  } else {
    const { error } = await res.json().catch(() => ({ error: "Dështoi." }));
    setStatus(error || "Dështoi.", "err");
  }
});

// ---------- init ----------

document.querySelector(`.edit-lang-btn[data-lang-tab="${currentEditLang}"]`).classList.add("active");

checkAuth();
loadLoginLogo();
