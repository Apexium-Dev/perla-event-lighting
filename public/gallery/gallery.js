const LANGS = ["sq", "mk", "en"];
const DEFAULT_LANG = "sq";
const HEADING = { sq: "Galeria", mk: "Галерија", en: "Gallery" };
const BACK_TEXT = { sq: "Kthehu", mk: "Назад", en: "Back" };
const EMPTY_TEXT = {
  sq: "Së shpejti do të shtojmë foto këtu.",
  mk: "Наскоро ќе додадеме фотографии овде.",
  en: "Photos coming soon.",
};

function safeStorage(action) {
  try {
    return action();
  } catch {
    return null;
  }
}

let currentLang = safeStorage(() => localStorage.getItem("perla-lang")) || DEFAULT_LANG;
if (!LANGS.includes(currentLang)) currentLang = DEFAULT_LANG;

let galleryPhotos = [];

function render(lang) {
  const heading = HEADING[lang] || HEADING[DEFAULT_LANG];
  document.getElementById("gallery-page-heading").textContent = heading;
  document.getElementById("back-text").textContent = BACK_TEXT[lang] || BACK_TEXT[DEFAULT_LANG];
  document.title = `${heading} — Perla Event Lighting`;

  const grid = document.getElementById("gallery-grid");
  grid.textContent = "";
  for (const photo of galleryPhotos) {
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
  grid.hidden = galleryPhotos.length === 0;

  const empty = document.getElementById("gallery-empty");
  empty.textContent = EMPTY_TEXT[lang] || EMPTY_TEXT[DEFAULT_LANG];
  empty.hidden = galleryPhotos.length > 0;

  document.documentElement.lang = lang;
  for (const btn of document.querySelectorAll(".lang-btn")) {
    btn.classList.toggle("active", btn.dataset.lang === lang);
  }
}

function setLanguage(lang) {
  if (!LANGS.includes(lang)) return;
  currentLang = lang;
  safeStorage(() => localStorage.setItem("perla-lang", lang));
  render(currentLang);
}

for (const btn of document.querySelectorAll(".lang-btn")) {
  btn.addEventListener("click", () => setLanguage(btn.dataset.lang));
}

fetch("/api/gallery", { cache: "no-store" })
  .then((r) => r.json())
  .then((photos) => {
    galleryPhotos = Array.isArray(photos) ? photos : [];
    render(currentLang);
  })
  .catch((err) => {
    console.error("Failed to load gallery", err);
    render(currentLang);
  });
