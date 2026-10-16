import { getPheeImages } from "./phee.js";

function save(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`Couldn't save ${key} preference:`, err);
  }
}

const root = document.documentElement;
const themeBtn = document.getElementById("theme-toggle");

function currentTheme() {
  const set = root.getAttribute("data-theme");
  if (set) return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

if (themeBtn) {
  const updateThemeLabel = () => {
    themeBtn.textContent = currentTheme() === "dark" ? "Light mode" : "Dark mode";
  };
  themeBtn.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    save("theme", next);
    updateThemeLabel();
  });
  updateThemeLabel();
}

const swatches = document.querySelectorAll(".swatch");
function setAccent(name) {
  root.setAttribute("data-accent", name);
  swatches.forEach((swatch) =>
    swatch.setAttribute("aria-pressed", String(swatch.dataset.accent === name)),
  );
}
swatches.forEach((swatch) => {
  swatch.addEventListener("click", () => {
    setAccent(swatch.dataset.accent);
    save("accent", swatch.dataset.accent);
  });
});
if (swatches.length) setAccent(root.getAttribute("data-accent") || "blue");

const homePheeImg = document.getElementById("home-phee-img");
const homePheeFallback = document.getElementById("home-phee-fallback");
if (homePheeImg && homePheeFallback) {
  getPheeImages()
    .then((images) => {
      if (!images.length) throw new Error("No Phee photos are listed in the manifest");
      const image = images[Math.floor(Math.random() * images.length)];
      return new Promise((resolve, reject) => {
        const loader = new Image();
        loader.onload = () => resolve(image);
        loader.onerror = () => reject(new Error(`Couldn't load Phee photo: ${image}`));
        loader.src = image;
      });
    })
    .then((image) => {
      homePheeImg.src = image;
      homePheeImg.hidden = false;
      homePheeFallback.hidden = true;
    })
    .catch((err) => {
      console.error("Home Phee photo failed to load:", err);
      homePheeFallback.textContent = "Couldn't load a Phee photo right now.";
    });
}

const cornifyBtn = document.getElementById("cornify-btn");
const cornifyStatus = document.getElementById("cornify-status");
let cornifyLoad;

function loadCornify() {
  if (typeof window.cornify_add === "function") return Promise.resolve();
  if (cornifyLoad) return cornifyLoad;

  cornifyLoad = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://www.cornify.com/js/cornify.js";
    script.async = true;
    script.addEventListener(
      "load",
      () => {
        if (typeof window.cornify_add === "function") resolve();
        else reject(new Error("Cornify loaded without its add function"));
      },
      { once: true },
    );
    script.addEventListener("error", () => reject(new Error("Cornify script failed to load")), {
      once: true,
    });
    document.head.append(script);
  });
  return cornifyLoad;
}

if (cornifyBtn && cornifyStatus) {
  cornifyBtn.addEventListener("click", async () => {
    cornifyBtn.disabled = true;
    cornifyStatus.textContent = "Adding some sparkle...";
    try {
      await loadCornify();
      window.cornify_add();
      cornifyStatus.textContent = "Cornified!";
    } catch (err) {
      console.error("Cornify failed:", err);
      cornifyStatus.textContent = "Couldn't load Cornify. Check your connection and try again.";
      cornifyLoad = null;
    } finally {
      cornifyBtn.disabled = false;
    }
  });
}

const navToggle = document.getElementById("nav-toggle");
const nav = document.getElementById("site-nav");
if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  nav.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a")) {
      nav.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
}

const year = document.getElementById("year");
if (year) year.textContent = String(new Date().getFullYear());
