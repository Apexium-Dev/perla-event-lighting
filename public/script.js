document.getElementById("year").textContent = new Date().getFullYear();

const LANGS = ["sq", "mk", "en"];
const DEFAULT_LANG = "sq";
const SERVICES_HEADING = { sq: "Çfarë ofrojmë", mk: "Што нудиме", en: "What we offer" };

function safeStorage(action) {
  try {
    return action();
  } catch {
    return null;
  }
}

let siteContent = null;
let currentLang = safeStorage(() => localStorage.getItem("perla-lang")) || DEFAULT_LANG;
if (!LANGS.includes(currentLang)) currentLang = DEFAULT_LANG;

function t(i18nObj, field, lang) {
  for (const tryLang of [lang, DEFAULT_LANG, ...LANGS]) {
    const val = i18nObj?.[tryLang]?.[field];
    if (val) return val;
  }
  return "";
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderContent(data, lang) {
  document.getElementById("brand-logo").src = data.logo || "assets/logo.svg";
  document.getElementById("brand-name").textContent = data.name || "";
  document.getElementById("brand-name-sub").textContent = data.nameSub || "";

  document.getElementById("brand-tagline").textContent = t(data.i18n, "tagline", lang);

  const locationEl = document.getElementById("brand-location");
  locationEl.textContent = "";
  const locationText = t(data.i18n, "location", lang);
  if (locationText) {
    locationEl.appendChild(iconElement("map-pin"));
    locationEl.appendChild(document.createTextNode(locationText));
  }

  document.getElementById("footer-note").textContent = t(data.i18n, "footerNote", lang);
  document.getElementById("services-heading").textContent =
    SERVICES_HEADING[lang] || SERVICES_HEADING[DEFAULT_LANG];

  const linksList = document.getElementById("links-list");
  linksList.textContent = "";
  for (const link of data.links || []) {
    const a = document.createElement("a");
    a.className = link.primary ? "link link-primary" : "link";
    a.href = link.url || "#";
    if (/^https?:\/\//i.test(link.url || "")) {
      a.target = "_blank";
      a.rel = "noopener";
    }
    const ic = el("span", "ic");
    ic.appendChild(iconElement(link.icon));
    const txt = el("span", "txt");
    txt.appendChild(el("strong", null, t(link.i18n, "title", lang)));
    txt.appendChild(el("small", null, t(link.i18n, "subtitle", lang)));
    const go = el("span", "go", "→");
    a.append(ic, txt, go);
    linksList.appendChild(a);
  }

  const chips = document.getElementById("services-chips");
  chips.textContent = "";
  for (const service of data.services || []) {
    const chip = el("span", "chip");
    chip.appendChild(iconElement(service.icon));
    chip.appendChild(document.createTextNode(t(service.i18n, "text", lang)));
    chips.appendChild(chip);
  }

  document.documentElement.lang = lang;
  for (const btn of document.querySelectorAll(".lang-btn")) {
    btn.classList.toggle("active", btn.dataset.lang === lang);
  }
}

function setLanguage(lang) {
  if (!LANGS.includes(lang)) return;
  currentLang = lang;
  safeStorage(() => localStorage.setItem("perla-lang", lang));
  if (siteContent) renderContent(siteContent, currentLang);
}

for (const btn of document.querySelectorAll(".lang-btn")) {
  btn.addEventListener("click", () => setLanguage(btn.dataset.lang));
}

fetch("/api/content", { cache: "no-store" })
  .then((r) => r.json())
  .then((data) => {
    siteContent = data;
    renderContent(data, currentLang);
  })
  .catch((err) => console.error("Failed to load content", err));
