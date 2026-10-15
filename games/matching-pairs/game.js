// Matching Pairs
//
// Twelve cards, twelve different photos: there are no real pairs.
// The paw print under the board is a hidden switch. While it is ON, the photo
// behind each card you flip is swapped for a copy of the photo already face
// up, so the two cards really are the same picture and the pair stays open.
// Switch it OFF and nothing is swapped any more, so nothing matches again.
import { getPheeImages, pheeThumb } from "../../js/phee.js";
import { loadCss, shuffle } from "../shared.js";

const CARD_COUNT = 12; // 12 different photos -> 12 cards, 6 "pairs"
const MISMATCH_DELAY = 900; // ms a wrong pair stays face up

const PAW = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <g fill="currentColor">
    <ellipse cx="12" cy="16.2" rx="5.2" ry="4.2"/>
    <ellipse cx="5.2" cy="11.4" rx="2" ry="2.7" transform="rotate(-20 5.2 11.4)"/>
    <ellipse cx="9.3" cy="6.6" rx="2" ry="2.9" transform="rotate(-8 9.3 6.6)"/>
    <ellipse cx="14.7" cy="6.6" rx="2" ry="2.9" transform="rotate(8 14.7 6.6)"/>
    <ellipse cx="18.8" cy="11.4" rx="2" ry="2.7" transform="rotate(20 18.8 11.4)"/>
  </g>
</svg>`;

function tryLoad(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Prefer the small thumbnail, fall back to the full photo.
async function loadPhoto(url) {
  const src = (await tryLoad(pheeThumb(url))) || (await tryLoad(url));
  return src ? { key: url, src } : null;
}

// Pick `want` random photos that actually load (skipping any broken ones).
async function pickPhotos(want) {
  const pool = shuffle(await getPheeImages());
  const picked = [];
  let next = 0;
  while (picked.length < want && next < pool.length) {
    const batch = pool.slice(next, next + (want - picked.length));
    next += batch.length;
    const loaded = await Promise.all(batch.map(loadPhoto));
    picked.push(...loaded.filter(Boolean));
  }
  if (picked.length % 2 === 1) picked.pop(); // keep the card count even
  return picked;
}

export async function mount(container) {
  await loadCss(new URL("./game.css", import.meta.url));

  const root = document.createElement("div");
  root.className = "mp";
  root.innerHTML = `
    <div class="mp-bar">
      <p class="mp-stats">
        <span>Moves: <strong data-moves>0</strong></span>
        <span>Pairs: <strong data-pairs>0</strong> / <span data-total>6</span></span>
      </p>
      <button type="button" class="button mp-new">New game</button>
    </div>
    <div class="mp-board" data-board></div>
    <div class="mp-foot">
      <p class="mp-message" role="status" aria-live="polite" data-message></p>
      <button type="button" class="mp-paw" aria-label="Paw print" data-paw>${PAW}</button>
    </div>`;
  container.append(root);

  const board = root.querySelector("[data-board]");
  const message = root.querySelector("[data-message]");
  const movesOut = root.querySelector("[data-moves]");
  const pairsOut = root.querySelector("[data-pairs]");
  const totalOut = root.querySelector("[data-total]");
  const newBtn = root.querySelector(".mp-new");
  const paw = root.querySelector("[data-paw]");

  let cards = []; // { key, src, el, img, flipped, matched }
  let faceUp = []; // cards flipped this turn and not yet judged (0 or 1)
  let moves = 0;
  let pairs = 0;
  let locked = true; // true while a wrong pair is showing or photos load
  let switchOn = false; // the hidden switch
  let timer = null;
  let generation = 0; // ignores results from an out-of-date "new game"
  let destroyed = false;

  const say = (text) => {
    message.textContent = text;
  };

  function updateStats() {
    movesOut.textContent = moves;
    pairsOut.textContent = pairs;
    totalOut.textContent = cards.length / 2;
  }

  function label(card, index) {
    const state = card.matched
      ? "matched"
      : card.flipped
        ? "face up"
        : "face down";
    card.el.setAttribute("aria-label", `Card ${index + 1}, ${state}`);
  }

  function setFlipped(card, value) {
    card.flipped = value;
    card.el.classList.toggle("is-flipped", value);
    label(card, cards.indexOf(card));
  }

  function buildCard(card, index) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mp-card";
    btn.dataset.index = index;
    btn.innerHTML = `
      <span class="mp-card-inner">
        <span class="mp-face mp-back" aria-hidden="true">${PAW}</span>
        <span class="mp-face mp-front"><img alt="" draggable="false" /></span>
      </span>`;
    card.img = btn.querySelector("img");
    card.img.src = card.src;
    card.el = btn;
    label(card, index);
    return btn;
  }

  function flip(card) {
    if (locked || card.flipped || card.matched) return;

    // The hidden switch: this card is still face down, so quietly change the
    // photo behind it to a copy of the one already face up.
    const first = faceUp[0];
    if (switchOn && first) {
      card.key = first.key;
      card.src = first.src;
      card.img.src = first.src;
    }

    setFlipped(card, true);
    faceUp.push(card);
    if (faceUp.length < 2) {
      say("Now pick a second card.");
      return;
    }

    moves++;
    const [a, b] = faceUp;
    faceUp = [];

    // A genuine match: both cards show the same photo.
    if (a.key === b.key) {
      for (const c of [a, b]) {
        c.matched = true;
        c.el.classList.add("is-matched");
        label(c, cards.indexOf(c));
      }
      pairs++;
      updateStats();
      say(
        pairs === cards.length / 2
          ? `All ${pairs} pairs found in ${moves} moves!`
          : "It's a match!",
      );
      return;
    }

    updateStats();
    locked = true;
    say("No match. Remember where they were.");
    timer = setTimeout(() => {
      timer = null;
      setFlipped(a, false);
      setFlipped(b, false);
      locked = false;
    }, MISMATCH_DELAY);
  }

  async function newGame() {
    const mine = ++generation;
    clearTimeout(timer);
    timer = null;
    faceUp = [];
    cards = [];
    moves = 0;
    pairs = 0;
    locked = true;
    switchOn = false;
    paw.classList.remove("is-on");
    board.replaceChildren();
    updateStats();
    newBtn.disabled = true;
    say("Shuffling the cards\u2026");

    try {
      const photos = await pickPhotos(CARD_COUNT);
      if (destroyed || mine !== generation) return;
      if (photos.length < 2) {
        say("Add at least two photos to images/phee/ to play.");
        return;
      }

      cards = shuffle(photos).map((photo) => ({
        key: photo.key,
        src: photo.src,
        el: null,
        img: null,
        flipped: false,
        matched: false,
      }));
      board.replaceChildren(...cards.map(buildCard));
      updateStats();
      locked = false;
      say("Flip two cards to find a match.");
    } catch (err) {
      console.error("Couldn't set up the game:", err);
      if (!destroyed && mine === generation) {
        say("Couldn't load the photos. Try New game.");
      }
    } finally {
      if (!destroyed && mine === generation) newBtn.disabled = false;
    }
  }

  board.addEventListener("click", (event) => {
    const btn = event.target.closest(".mp-card");
    if (btn) flip(cards[Number(btn.dataset.index)]);
  });
  newBtn.addEventListener("click", newGame);

  // The hidden switch. Deliberately silent: no message, no announcement.
  // It only changes what happens to the NEXT card you flip.
  function toggleSwitch() {
    switchOn = !switchOn;
    paw.classList.toggle("is-on", switchOn);
  }
  paw.addEventListener("click", toggleSwitch);

  // Keyboard shortcut: any arrow key flips the switch.
  function onKeyDown(event) {
    if (!event.key.startsWith("Arrow")) return;
    if (event.repeat) return; // holding a key down counts once
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return; // e.g. Alt+Left = browser Back
    const el = event.target;
    if (
      el instanceof HTMLElement &&
      el.closest("input, textarea, select, [contenteditable]")
    )
      return; // typing in a form
    toggleSwitch();
    // To stop the page scrolling when you press an arrow key, uncomment:
    // event.preventDefault();
  }
  document.addEventListener("keydown", onKeyDown);

  newGame();

  return {
    destroy() {
      destroyed = true;
      clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      root.remove();
    },
  };
}
