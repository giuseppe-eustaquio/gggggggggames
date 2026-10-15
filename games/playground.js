// The Playground: a list of games, and a place to play the one you pick.
// Routing uses the URL hash:  #playground  = the list,
//                             #playground/<id>  = a game.
// so links, the Back button and sharing a direct link all work.
import { games } from "./registry.js";

const section = document.getElementById("playground");
const app = document.getElementById("playground-app");

let shown; // id of the game on screen, null for the list, undefined at start
let current = null; // { destroy() } of the running game
let token = 0; // lets a slow game load notice it's out of date

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function parseHash() {
  const hash = location.hash;
  if (hash === "" || hash === "#playground") return { game: null };
  const match = hash.match(/^#playground\/(.+)$/);
  if (match) return { game: games.find((g) => g.id === match[1]) || null };
  return null; // some other link on the page; leave the Playground alone
}

function stopGame() {
  if (!current) return;
  try {
    current.destroy?.();
  } catch (err) {
    console.error("Game cleanup failed:", err);
  }
  current = null;
}

function showList(focusId) {
  token++;
  stopGame();

  const list = make("ul", "game-list");
  for (const game of games) {
    const item = make("li");
    const card = make("a", "game-card");
    card.href = `#playground/${game.id}`;
    card.dataset.game = game.id;
    card.append(
      make("h3", "", game.title),
      make("p", "", game.blurb),
      make("span", "game-card-cta", "Play \u2192"),
    );
    item.append(card);
    list.append(item);
  }

  app.replaceChildren(
    make("p", "", "A small collection of games. Pick one to play."),
    list,
  );

  if (focusId) {
    app.querySelector(`[data-game="${focusId}"]`)?.focus({ preventScroll: true });
  }
}

async function showGame(game, { focus }) {
  const myToken = ++token;
  stopGame();

  const back = make("a", "back-link", "\u2190 All games");
  back.href = "#playground";
  const title = make("h3", "", game.title);
  title.tabIndex = -1;
  const stage = make("div", "game-stage");
  stage.append(make("p", "game-loading", "Loading\u2026"));

  app.replaceChildren(make("div", "game-head"), stage);
  app.firstChild.append(back, title);
  if (focus) title.focus({ preventScroll: true });

  try {
    const module = await game.load();
    if (myToken !== token) return;
    stage.replaceChildren();
    const running = await module.mount(stage);
    if (myToken !== token) {
      running?.destroy?.(); // the person moved on while it was loading
      return;
    }
    current = running;
  } catch (err) {
    console.error(`Couldn't load "${game.id}":`, err);
    if (myToken === token) {
      stage.replaceChildren(make("p", "game-loading", "Couldn't load this game. Try again."));
    }
  }
}

function route({ userAction }) {
  const target = parseHash() ?? (shown === undefined ? { game: null } : null);
  if (!target) return;

  const id = target.game ? target.game.id : null;
  if (id === shown) return;

  const previous = shown;
  shown = id;

  if (target.game) {
    showGame(target.game, { focus: userAction });
    section.scrollIntoView({ block: "start" }); // no element has this hash, so scroll ourselves
  } else {
    showList(userAction ? previous : null);
  }
}

if (section && app) {
  window.addEventListener("hashchange", () => route({ userAction: true }));
  route({ userAction: false });
}
