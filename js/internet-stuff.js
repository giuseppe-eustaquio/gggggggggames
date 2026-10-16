import { getPheeImages } from "./phee.js";

const FACT_API = "https://uselessfacts.jsph.pl/api/v2/facts";
const factText = document.getElementById("fact-text");
const factSource = document.getElementById("fact-source");
const factBtn = document.getElementById("fact-btn");

async function loadFact(random = false) {
  factBtn.disabled = true;
  factText.textContent = random ? "Finding a random fact..." : "Fetching today's fact...";
  factSource.hidden = true;
  try {
    const endpoint = random ? "random" : "today";
    const response = await fetch(`${FACT_API}/${endpoint}?language=en`);
    if (!response.ok) throw new Error("API returned " + response.status);
    const data = await response.json();
    if (typeof data.text !== "string" || !data.text) throw new Error("API response had no fact");

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
loadFact();

const adviceText = document.getElementById("advice-text");
const adviceBtn = document.getElementById("advice-btn");
const adviceSearch = document.getElementById("advice-search");
const adviceQuery = document.getElementById("advice-query");
const adviceSearchBtn = document.getElementById("advice-search-btn");
const adviceSearchStatus = document.getElementById("advice-search-status");
const ADVICE_API = "https://api.adviceslip.com";

async function loadRandomAdvice() {
  adviceBtn.disabled = true;
  adviceSearchBtn.disabled = true;
  adviceSearchStatus.textContent = "";
  adviceText.textContent = "Finding some advice...";
  try {
    const response = await fetch(`${ADVICE_API}/advice?cache=${Date.now()}`);
    if (!response.ok) throw new Error("API returned " + response.status);
    const data = await response.json();
    if (typeof data.slip?.advice !== "string" || !data.slip.advice) {
      throw new Error("API response had no advice");
    }
    adviceText.textContent = data.slip.advice;
  } catch (err) {
    console.error("Couldn't load random advice:", err);
    adviceText.textContent = "Couldn't fetch advice right now. Try again.";
  } finally {
    adviceBtn.disabled = false;
    adviceSearchBtn.disabled = false;
  }
}

adviceBtn.addEventListener("click", loadRandomAdvice);
loadRandomAdvice();

adviceSearch.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = adviceQuery.value.trim();
  if (!query || /\s/.test(query)) {
    adviceSearchStatus.textContent = "Please enter a single word to search.";
    return;
  }

  adviceSearchBtn.disabled = true;
  adviceBtn.disabled = true;
  adviceSearchStatus.textContent = "";
  adviceText.textContent = "Searching advice...";
  try {
    const response = await fetch(`${ADVICE_API}/advice/search/${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error("API returned " + response.status);
    const data = await response.json();
    const results = Array.isArray(data.slips) ? data.slips : [];
    if (results.length === 0) {
      adviceText.textContent = `No advice found for "${query}". Try another word.`;
      adviceSearchStatus.textContent = "No results found.";
    } else {
      adviceText.textContent = results[Math.floor(Math.random() * results.length)].advice;
      adviceSearchStatus.textContent = `Found ${results.length} matching piece${results.length === 1 ? "" : "s"} of advice.`;
    }
  } catch (err) {
    console.error("Advice search failed:", err);
    adviceText.textContent = "Couldn't search advice right now. Try again.";
  } finally {
    adviceSearchBtn.disabled = false;
    adviceBtn.disabled = false;
  }
});

const jokeText = document.getElementById("joke-text");
const jokeBtn = document.getElementById("joke-btn");
const JOKE_API = "https://v2.jokeapi.dev/joke/Any";
const JOKE_FLAGS = "nsfw,religious,political,racist,sexist,explicit";

async function loadJoke() {
  jokeBtn.disabled = true;
  jokeText.textContent = "Finding a joke...";
  try {
    const response = await fetch(`${JOKE_API}?blacklistFlags=${JOKE_FLAGS}`);
    if (!response.ok) throw new Error("API returned " + response.status);
    const data = await response.json();
    if (data.error) throw new Error(data.message || "Joke API returned an error");

    if (data.type === "single" && typeof data.joke === "string") {
      jokeText.textContent = data.joke;
    } else if (
      data.type === "twopart" &&
      typeof data.setup === "string" &&
      typeof data.delivery === "string"
    ) {
      const setup = document.createElement("p");
      setup.textContent = data.setup;
      const delivery = document.createElement("p");
      delivery.textContent = data.delivery;
      delivery.style.marginBottom = "0";
      jokeText.replaceChildren(setup, delivery);
    } else {
      throw new Error("Joke API returned an unsupported joke format");
    }
  } catch (err) {
    console.error("Joke fetch failed:", err);
    jokeText.textContent = "Couldn't fetch a joke right now. Try again.";
  } finally {
    jokeBtn.disabled = false;
  }
}
jokeBtn.addEventListener("click", loadJoke);
loadJoke();

const DOG_API = "https://dog.ceo/api/breeds/image/random";
const dogImg = document.getElementById("dog-img");
const dogFallback = document.getElementById("dog-fallback");
const dogCaption = document.getElementById("dog-caption");
const dogApiBtn = document.getElementById("dog-api-btn");
const pheeBtn = document.getElementById("phee-btn");

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
    const response = await fetch(DOG_API);
    if (!response.ok) throw new Error("API returned " + response.status);
    const data = await response.json();
    if (data.status !== "success") throw new Error("API error");
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
    if (dogImg.hidden) dogFallback.textContent = "Couldn't fetch a dog right now.";
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
    const current = dogImg.getAttribute("src");
    const choices = allImages.length > 1 ? allImages.filter((image) => image !== current) : allImages;
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
    if (dogImg.hidden) dogFallback.textContent = "Couldn't load a Phee photo.";
  } finally {
    pheeBtn.disabled = false;
  }
}

dogApiBtn.addEventListener("click", loadDog);
pheeBtn.addEventListener("click", loadPhee);
loadPhee();
