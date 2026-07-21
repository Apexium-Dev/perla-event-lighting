document.getElementById("year").textContent = new Date().getFullYear();

const LANGS = ["sq", "mk", "en"];
const DEFAULT_LANG = "sq";
const SERVICES_HEADING = { sq: "Çfarë ofrojmë", mk: "Што нудиме", en: "What we offer" };
const GALLERY_HEADING = { sq: "Galeria", mk: "Галерија", en: "Gallery" };

function safeStorage(action) {
  try {
    return action();
  } catch {
    return null;
  }
}

let siteContent = null;
let galleryPhotos = [];
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

function renderGallery(photos, lang) {
  document.getElementById("gallery-heading").textContent = GALLERY_HEADING[lang] || GALLERY_HEADING[DEFAULT_LANG];

  const grid = document.getElementById("gallery-grid");
  grid.textContent = "";
  for (const photo of photos) {
    const a = document.createElement("a");
    a.href = photo.url;
    a.target = "_blank";
    a.rel = "noopener";
    const img = document.createElement("img");
    img.src = photo.url;
    img.alt = "";
    img.loading = "lazy";
    a.appendChild(img);
    grid.appendChild(a);
  }

  document.getElementById("gallery").hidden = photos.length === 0;
}

function setLanguage(lang) {
  if (!LANGS.includes(lang)) return;
  currentLang = lang;
  safeStorage(() => localStorage.setItem("perla-lang", lang));
  if (siteContent) renderContent(siteContent, currentLang);
  renderGallery(galleryPhotos, currentLang);
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

fetch("/api/gallery", { cache: "no-store" })
  .then((r) => r.json())
  .then((photos) => {
    galleryPhotos = Array.isArray(photos) ? photos : [];
    renderGallery(galleryPhotos, currentLang);
  })
  .catch((err) => console.error("Failed to load gallery", err));

const canvas = document.getElementById("fx");
const ctx = canvas.getContext("2d");
let w, h, particles;

const PARTICLE_COUNT = 60;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function resize() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
}

function makeParticle() {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    r: Math.random() * 1.6 + 0.4,
    speed: Math.random() * 0.35 + 0.08,
    drift: (Math.random() - 0.5) * 0.25,
    twinkle: Math.random() * Math.PI * 2,
    twinkleSpeed: Math.random() * 0.02 + 0.008,
  };
}

function init() {
  resize();
  particles = Array.from({ length: PARTICLE_COUNT }, makeParticle);
}

function tick() {
  ctx.clearRect(0, 0, w, h);
  for (const p of particles) {
    p.twinkle += p.twinkleSpeed;
    const alpha = 0.35 + Math.sin(p.twinkle) * 0.35;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(217, 184, 114, ${Math.max(alpha, 0)})`;
    ctx.shadowColor = "rgba(243, 216, 150, 0.8)";
    ctx.shadowBlur = 4;
    ctx.fill();

    p.y -= p.speed;
    p.x += p.drift;
    if (p.y < -5) {
      p.y = h + 5;
      p.x = Math.random() * w;
    }
    if (p.x < -5) p.x = w + 5;
    if (p.x > w + 5) p.x = -5;
  }
  requestAnimationFrame(tick);
}

window.addEventListener("resize", resize);

if (!reduceMotion) {
  init();
  requestAnimationFrame(tick);
} else {
  canvas.style.display = "none";
}
