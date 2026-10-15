import { getPheeImages } from "./phee.js";

// Small helpers so a blocked/disabled localStorage never breaks the page
function save(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {}
}

const root = document.documentElement;

// ---------- Theme toggle ----------
const themeBtn = document.getElementById("theme-toggle");

function currentTheme() {
  const set = root.getAttribute("data-theme");
  if (set) return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function updateThemeLabel() {
  themeBtn.textContent = currentTheme() === "dark" ? "Light mode" : "Dark mode";
}

themeBtn.addEventListener("click", () => {
  const next = currentTheme() === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  save("theme", next);
  updateThemeLabel();
});
updateThemeLabel();

// ---------- Accent color ----------
const swatches = document.querySelectorAll(".swatch");

function setAccent(name) {
  root.setAttribute("data-accent", name);
  swatches.forEach((s) =>
    s.setAttribute("aria-pressed", String(s.dataset.accent === name)),
  );
}

swatches.forEach((s) => {
  s.addEventListener("click", () => {
    setAccent(s.dataset.accent);
    save("accent", s.dataset.accent);
  });
});
setAccent(root.getAttribute("data-accent") || "blue");

// ---------- Random dog header (Dog CEO API) ----------
const DOG_API = "https://dog.ceo/api/breeds/image/random";
const dogImg = document.getElementById("dog-img");
const dogFallback = document.getElementById("dog-fallback");
const dogCaption = document.getElementById("dog-caption");
const dogApiBtn = document.getElementById("dog-api-btn");
const pheeBtn = document.getElementById("phee-btn");
// "hound-afghan" -> "Afghan hound", "pug" -> "Pug"
function breedFromUrl(url) {
  const match = url.match(/\/breeds\/([^/]+)\//);
  if (!match) return "Dog";
  const name = match[1].split("-").reverse().join(" ");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

async function loadDog() {
  dogApiBtn.disabled = true;
  dogCaption.textContent = "Fetching a dog…";

  try {
    const res = await fetch(DOG_API);
    if (!res.ok) throw new Error("API returned " + res.status);
    const data = await res.json();
    if (data.status !== "success") throw new Error("API error");

    // Load the image off-screen first, then swap it in, so the old photo
    // stays visible until the new one is fully ready.
    const url = data.message;
    const breed = breedFromUrl(url);
    await new Promise((resolve, reject) => {
      const loader = new Image();
      loader.onload = resolve;
      loader.onerror = reject;
      loader.src = url;
    });

    dogImg.src = url;
    dogImg.alt = "A dog of the breed: " + breed;
    dogImg.hidden = false;
    dogFallback.hidden = true;
    dogCaption.textContent = breed;
  } catch (err) {
    console.error("Dog fetch failed:", err);
    if (dogImg.hidden) {
      dogFallback.textContent = "Couldn't fetch a dog right now.";
    }
    dogCaption.textContent = "Couldn't fetch a dog. Try again.";
  } finally {
    dogApiBtn.disabled = false;
  }
}

async function loadPhee() {
  pheeBtn.disabled = true;

  try {
    const allImages = await getPheeImages();
    if (allImages.length === 0) throw new Error("No images in manifest");

    // Avoid showing the same photo twice in a row (if there's a choice).
    const current = dogImg.getAttribute("src");
    const choices =
      allImages.length > 1
        ? allImages.filter((img) => img !== current)
        : allImages;
    const image = choices[Math.floor(Math.random() * choices.length)];

    await new Promise((resolve, reject) => {
      const loader = new Image();
      loader.onload = resolve;
      loader.onerror = reject;
      loader.src = image;
    });

    dogImg.src = image;
    dogImg.alt = "Phee";
    dogImg.hidden = false;
    dogFallback.hidden = true;
    dogCaption.textContent = "Phee";
  } catch (err) {
    console.error("Phee photo failed to load:", err);
    if (dogImg.hidden) {
      dogFallback.textContent = "Couldn't load a Phee photo.";
    }
  } finally {
    pheeBtn.disabled = false;
  }
}

dogApiBtn.addEventListener("click", loadDog);
pheeBtn.addEventListener("click", loadPhee);
loadPhee();

// ---------- Useless fact (Useless Facts API) ----------
const FACT_API = "https://uselessfacts.jsph.pl/api/v2/facts";
const factText = document.getElementById("fact-text");
const factSource = document.getElementById("fact-source");
const factBtn = document.getElementById("fact-btn");

async function loadFact(random = false) {
  factBtn.disabled = true;
  factText.textContent = random
    ? "Finding a random fact..."
    : "Fetching today's fact...";
  factSource.hidden = true;

  try {
    const endpoint = random ? "random" : "today";
    const res = await fetch(`${FACT_API}/${endpoint}?language=en`);
    if (!res.ok) throw new Error("API returned " + res.status);
    const data = await res.json();
    if (typeof data.text !== "string" || !data.text)
      throw new Error("API response had no fact");

    factText.textContent = data.text;
    if (data.source_url) {
      factSource.replaceChildren();
      const link = document.createElement("a");
      link.href = data.source_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = data.source || "Fact source";
      factSource.append("Source: ", link);
      factSource.hidden = false;
    }
  } catch (err) {
    console.error("Fact fetch failed:", err);
    factText.textContent = "Couldn't fetch a fact right now. Try again.";
  } finally {
    factBtn.disabled = false;
  }
}

factBtn.addEventListener("click", () => loadFact(true));
loadFact(); // today's fact on every page load

// ---------- Mobile menu ----------
const navToggle = document.getElementById("nav-toggle");
const nav = document.getElementById("site-nav");

navToggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(open));
});
nav.addEventListener("click", (e) => {
  if (e.target.tagName === "A") {
    nav.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  }
});

// ---------- Contact form (placeholder) ----------
document.getElementById("contact-form").addEventListener("submit", (e) => {
  e.preventDefault();
  document.getElementById("form-status").textContent =
    "Form works. It isn't connected to an email service yet.";
});

// ---------- Footer year ----------
document.getElementById("year").textContent = new Date().getFullYear();
