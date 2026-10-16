// One-Player Chess
//
// Solo practice with White's pieces only. There is no opponent and no
// checkmate: nothing ends the session except the clock running out.
//
// Simplifications (there is no opponent to threaten you):
//   - No check rules or captures.
//   - Pawn captures and en passant are unavailable without opposing pieces.
//   - Castling and pawn promotion are included.
import { loadCss } from "../shared.js";

const MODES = [
  { id: "bullet", name: "Bullet", minutes: 3 },
  { id: "blitz", name: "Blitz", minutes: 10 },
  { id: "rapid", name: "Rapid", minutes: 60 },
];

const FILES = "abcdefgh";
const VS_TEXT = "\uFE0E"; // stops phones turning the pawn into an emoji
const GLYPH = {
  k: "\u265A",
  q: "\u265B",
  r: "\u265C",
  b: "\u265D",
  n: "\u265E",
  p: "\u265F",
};
const NAME = {
  k: "king",
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
  p: "pawn",
};
const PROMOTIONS = ["q", "r", "b", "n"];
const LOW_TIME_MS = 30000;

const KNIGHT = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];
const KING = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];
const ROOK_DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
const BISHOP_DIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

// Row 0 is rank 8, row 7 is rank 1.
const squareName = (r, c) => `${FILES[c]}${8 - r}`;
const glyph = (type) => GLYPH[type] + VS_TEXT;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const clamp = (n) => Math.max(0, Math.min(7, n));
const capital = (s) => s[0].toUpperCase() + s.slice(1);

function formatTime(ms) {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function newBoard() {
  const back = ["r", "n", "b", "q", "k", "b", "n", "r"];
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  back.forEach((type, c) => {
    board[6][c] = { t: "p", side: "w", moved: false };
    board[7][c] = { t: type, side: "w", moved: false };
  });
  return board;
}

const inBounds = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

// All empty squares the White piece on (r, c) can move to.
function movesFrom(board, r, c) {
  const piece = board[r][c];
  if (!piece || piece.side !== "w") return [];
  const out = [];

  // Returns true when the square was empty (so a sliding piece may go on).
  const add = (a, b) => {
    if (!inBounds(a, b)) return false;
    if (board[a][b]) return false;
    out.push({ r: a, c: b });
    return true;
  };
  const slide = (dirs) => {
    for (const [dr, dc] of dirs) {
      let a = r + dr;
      let b = c + dc;
      while (add(a, b)) {
        a += dr;
        b += dc;
      }
    }
  };

  switch (piece.t) {
    case "p":
      if (inBounds(r - 1, c) && !board[r - 1][c]) {
        out.push({ r: r - 1, c });
        if (r === 6 && !board[r - 2][c]) out.push({ r: r - 2, c });
      }
      break;
    case "n":
      for (const [dr, dc] of KNIGHT) add(r + dr, c + dc);
      break;
    case "b":
      slide(BISHOP_DIRS);
      break;
    case "r":
      slide(ROOK_DIRS);
      break;
    case "q":
      slide([...ROOK_DIRS, ...BISHOP_DIRS]);
      break;
    case "k": {
      for (const [dr, dc] of KING) add(r + dr, c + dc);
      if (!piece.moved && r === 7 && c === 4) {
        const kRook = board[7][7];
        if (
          kRook &&
          kRook.side === "w" &&
          kRook.t === "r" &&
          !kRook.moved &&
          !board[7][5] &&
          !board[7][6]
        ) {
          out.push({ r: 7, c: 6, castle: "k" });
        }
        const qRook = board[7][0];
        if (
          qRook &&
          qRook.side === "w" &&
          qRook.t === "r" &&
          !qRook.moved &&
          !board[7][1] &&
          !board[7][2] &&
          !board[7][3]
        ) {
          out.push({ r: 7, c: 2, castle: "q" });
        }
      }
      break;
    }
  }
  return out;
}

function anyMoves(board) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (movesFrom(board, r, c).length) return true;
    }
  }
  return false;
}

export async function mount(container) {
  await loadCss(new URL("./game.css", import.meta.url));

  const root = document.createElement("div");
  root.className = "ch";
  container.append(root);

  // ----- state -----
  let phase = "setup"; // "setup" | "play" | "over"
  let timerId = null;
  let deadline = 0;
  let mode = null;
  let board = null;
  let selected = null; // { r, c }
  let targets = [];
  let lastMove = null; // { from, to }
  let promo = null; // { from, to } while the promotion picker is open
  let cursor = { r: 6, c: 4 }; // the one square that is reachable with Tab
  let stats = { moves: 0, promotions: 0 };

  // ----- elements of the playing screen -----
  let boardEl;
  let clockEl;
  let movesOut;
  let statusEl;
  let promoEl;
  let overEl;

  function stopClock() {
    if (timerId !== null) clearInterval(timerId);
    timerId = null;
  }

  // ---------------------------------------------------------------- setup
  function renderSetup() {
    stopClock();
    phase = "setup";
    let chosenMode = null;
    let chosenSide = null;

    root.innerHTML = `
      <div class="ch-setup">
        <section class="ch-step">
          <h3>Choose a time control</h3>
          <div class="ch-modes">
            ${MODES.map(
              (m) => `
              <button type="button" class="ch-mode" data-mode="${m.id}" aria-pressed="false">
                <strong>${m.name}</strong>
                <span>${m.minutes} minutes</span>
              </button>`,
            ).join("")}
          </div>
        </section>
        <section class="ch-step">
          <h3>Choose your side</h3>
          <p class="ch-hint">Pick a card to reveal your side.</p>
          <div class="ch-sides">
            ${[0, 1]
              .map(
                (i) => `
              <button type="button" class="ch-side" data-side="${i}" aria-label="Mystery card ${i + 1}">
                <span class="ch-side-inner">
                  <span class="ch-side-face ch-side-front" aria-hidden="true">?</span>
                  <span class="ch-side-face ch-side-back" data-back></span>
                </span>
              </button>`,
              )
              .join("")}
          </div>
          <p class="ch-reveal" role="status" aria-live="polite" data-reveal></p>
        </section>
        <div class="ch-startrow">
          <button type="button" class="button ch-start" disabled>Start practice</button>
          <p class="ch-hint" data-startnote>Pick a time control and a side first.</p>
        </div>
      </div>`;

    const modeBtns = [...root.querySelectorAll(".ch-mode")];
    const sideBtns = [...root.querySelectorAll(".ch-side")];
    const reveal = root.querySelector("[data-reveal]");
    const start = root.querySelector(".ch-start");
    const startNote = root.querySelector("[data-startnote]");

    function refreshStart() {
      const ready = chosenMode !== null && chosenSide !== null;
      start.disabled = !ready;
      startNote.textContent = ready
        ? `${chosenMode.name}: ${chosenMode.minutes} minutes. The side you picked is White.`
        : "Pick a time control and a side first.";
    }

    modeBtns.forEach((btn) =>
      btn.addEventListener("click", () => {
        chosenMode = MODES.find((m) => m.id === btn.dataset.mode);
        modeBtns.forEach((b) =>
          b.setAttribute("aria-pressed", String(b === btn)),
        );
        refreshStart();
      }),
    );

    sideBtns.forEach((btn, i) =>
      btn.addEventListener("click", () => {
        if (chosenSide !== null) return;
        chosenSide = i;
        sideBtns.forEach((card, j) => {
          const white = j === i;
          card.classList.add("is-revealed");
          card.classList.toggle("is-yours", white);
          card.setAttribute("aria-disabled", "true");
          card.setAttribute("aria-label", white ? "White, your chosen side" : "Black");
          card.querySelector("[data-back]").innerHTML = `
            <span class="ch-piece ${white ? "is-white" : "is-black"}">${glyph("k")}</span>
            <span>${white ? "White — your side" : "Black"}</span>`;
        });
        reveal.textContent =
          "The side you picked is White; the other is Black. You’ll practice with White only.";
        refreshStart();
      }),
    );

    start.addEventListener("click", () => {
      if (chosenMode && chosenSide !== null) startGame(chosenMode);
    });
  }

  // ----------------------------------------------------------------- game
  function startGame(chosen) {
    mode = chosen;
    board = newBoard();
    selected = null;
    targets = [];
    lastMove = null;
    promo = null;
    stats = { moves: 0, promotions: 0 };
    cursor = { r: 6, c: 4 };
    phase = "play";

    root.innerHTML = `
      <div class="ch-hud">
        <div class="ch-clock" data-clock>${formatTime(mode.minutes * 60000)}</div>
        <p class="ch-stats">
          <span>${mode.name} solo practice</span>
          <span>Moves <strong data-moves>0</strong></span>
        </p>
      </div>

      <div class="ch-boardwrap">
        <div class="ch-board" data-board role="group" aria-label="Chess board. White pieces only."></div>

        <div class="ch-overlay ch-promo" data-promo hidden role="dialog" aria-modal="true" aria-label="Promote your pawn">
          <p>Promote your pawn to&hellip;</p>
          <div class="ch-promo-row">
            ${PROMOTIONS.map(
              (t) => `
              <button type="button" class="ch-promo-btn" data-promote="${t}" aria-label="${NAME[t]}">
                <span class="ch-piece is-white">${glyph(t)}</span>
              </button>`,
            ).join("")}
          </div>
          <button type="button" class="button" data-cancel>Cancel</button>
        </div>

        <div class="ch-overlay ch-over" data-over hidden role="alertdialog" aria-labelledby="ch-over-title"></div>
      </div>

      <p class="ch-status" role="status" aria-live="polite" data-status></p>
    `;

    boardEl = root.querySelector("[data-board]");
    clockEl = root.querySelector("[data-clock]");
    movesOut = root.querySelector("[data-moves]");
    statusEl = root.querySelector("[data-status]");
    promoEl = root.querySelector("[data-promo]");
    overEl = root.querySelector("[data-over]");

    boardEl.addEventListener("click", (event) => {
      const sq = event.target.closest(".ch-sq");
      if (sq) onSquare(Number(sq.dataset.r), Number(sq.dataset.c));
    });
    boardEl.addEventListener("keydown", onBoardKey);
    promoEl.addEventListener("click", (event) => {
      const pick = event.target.closest("[data-promote]");
      if (pick) finishPromotion(pick.dataset.promote);
      else if (event.target.closest("[data-cancel]")) closePromotion();
    });
    promoEl.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closePromotion();
    });

    statusEl.textContent =
      "Practice with White's pieces only. Move any piece while the clock runs.";
    renderBoard();

    deadline = Date.now() + mode.minutes * 60000;
    tick();
    timerId = setInterval(tick, 200);
  }

  function tick() {
    const left = Math.max(0, deadline - Date.now());
    clockEl.textContent = formatTime(left);
    clockEl.classList.toggle("is-low", left <= LOW_TIME_MS);
    if (left === 0) endGame();
  }

  function endGame() {
    stopClock();
    phase = "over";
    selected = null;
    targets = [];
    promo = null;
    promoEl.hidden = true;

    overEl.innerHTML = `
      <h3 id="ch-over-title">Time's up!</h3>
      <p>In ${mode.name.toLowerCase()} you made ${plural(stats.moves, "move")},
         promoting ${plural(stats.promotions, "pawn")}.</p>
      <button type="button" class="button" data-again>Play again</button>`;
    overEl.hidden = false;
    overEl
      .querySelector("[data-again]")
      .addEventListener("click", renderSetup);
    statusEl.textContent = "Time's up! The game is over.";
    renderBoard();
    overEl.querySelector("[data-again]").focus();
  }

  // -------------------------------------------------------------- playing
  function onSquare(r, c) {
    if (phase !== "play" || promo) return;
    cursor = { r, c };

    if (selected) {
      const target = targets.find((t) => t.r === r && t.c === c);
      if (target) {
        const from = selected;
        const piece = board[from.r][from.c];
        if (piece.t === "p" && target.r === 0) {
          openPromotion(from, target);
        } else {
          makeMove(from, target, null);
        }
        return;
      }
    }

    const piece = board[r][c];
    if (piece && piece.side === "w") {
      const same = selected && selected.r === r && selected.c === c;
      selected = same ? null : { r, c };
      targets = same ? [] : movesFrom(board, r, c);
    } else {
      selected = null;
      targets = [];
    }
    renderBoard(true);
  }

  function makeMove(from, to, promoteTo) {
    const piece = board[from.r][from.c];
    const typeBefore = piece.t;

    board[to.r][to.c] = piece;
    board[from.r][from.c] = null;
    piece.moved = true;

    if (to.castle === "k") {
      board[7][5] = board[7][7];
      board[7][7] = null;
      board[7][5].moved = true;
    } else if (to.castle === "q") {
      board[7][3] = board[7][0];
      board[7][0] = null;
      board[7][3].moved = true;
    }

    if (promoteTo) {
      piece.t = promoteTo;
      stats.promotions++;
    }
    stats.moves++;

    lastMove = { from: { r: from.r, c: from.c }, to: { r: to.r, c: to.c } };
    selected = null;
    targets = [];
    cursor = { r: to.r, c: to.c };

    let text;
    if (to.castle) {
      text = to.castle === "k" ? "Castled kingside." : "Castled queenside.";
    } else {
      text = `${capital(NAME[typeBefore])} ${squareName(from.r, from.c)} to ${squareName(to.r, to.c)}`;
      if (promoteTo) text += `, promoted to a ${NAME[promoteTo]}`;
      text += ".";
    }
    if (!anyMoves(board)) {
      text += " White has no moves left, so all that remains is watching the clock.";
    }
    statusEl.textContent = text;
    renderBoard(true);
  }

  function openPromotion(from, to) {
    promo = { from, to };
    promoEl.hidden = false;
    statusEl.textContent = "Choose a piece for your pawn.";
    renderBoard();
    promoEl.querySelector("[data-promote]").focus();
  }

  function finishPromotion(type) {
    if (!promo) return;
    const { from, to } = promo;
    promo = null;
    promoEl.hidden = true;
    makeMove(from, to, type);
  }

  function closePromotion() {
    if (!promo) return;
    promo = null;
    promoEl.hidden = true;
    statusEl.textContent = "Promotion cancelled.";
    renderBoard(true);
  }

  function onBoardKey(event) {
    const delta = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    }[event.key];
    if (delta) {
      event.preventDefault();
      cursor = { r: clamp(cursor.r + delta[0]), c: clamp(cursor.c + delta[1]) };
      renderBoard(true);
    } else if (event.key === "Escape" && selected) {
      selected = null;
      targets = [];
      renderBoard(true);
    }
  }

  // ------------------------------------------------------------ rendering
  function renderBoard(forceFocus = false) {
    const hadFocus = boardEl.contains(document.activeElement);
    const frag = document.createDocumentFragment();
    let focusTarget = null;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        const target = targets.find((t) => t.r === r && t.c === c);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `ch-sq ${(r + c) % 2 ? "is-dark" : "is-light"}`;
        btn.dataset.r = r;
        btn.dataset.c = c;

        if (selected && selected.r === r && selected.c === c) {
          btn.classList.add("is-selected");
        }
        if (target) btn.classList.add("is-target");
        if (
          lastMove &&
          ((lastMove.from.r === r && lastMove.from.c === c) ||
            (lastMove.to.r === r && lastMove.to.c === c))
        ) {
          btn.classList.add("is-last");
        }

        let label = squareName(r, c);
        if (piece) {
          label += `, white ${NAME[piece.t]}`;
        }
        if (selected && selected.r === r && selected.c === c) {
          label += ", selected";
        }
        if (target) label += ", can move here";
        btn.setAttribute("aria-label", label);

        const isCursor = r === cursor.r && c === cursor.c;
        btn.tabIndex = isCursor ? 0 : -1;
        if (isCursor) focusTarget = btn;

        if (c === 0) {
          const rank = document.createElement("i");
          rank.className = "ch-coord ch-coord-rank";
          rank.setAttribute("aria-hidden", "true");
          rank.textContent = 8 - r;
          btn.append(rank);
        }
        if (r === 7) {
          const file = document.createElement("i");
          file.className = "ch-coord ch-coord-file";
          file.setAttribute("aria-hidden", "true");
          file.textContent = FILES[c];
          btn.append(file);
        }
        if (piece) {
          const span = document.createElement("span");
          span.className = "ch-piece is-white";
          span.setAttribute("aria-hidden", "true");
          span.textContent = glyph(piece.t);
          btn.append(span);
        }
        frag.append(btn);
      }
    }
    boardEl.replaceChildren(frag);
    boardEl.classList.toggle("is-over", phase === "over");
    if (focusTarget && !promo && phase === "play" && (hadFocus || forceFocus)) {
      focusTarget.focus();
    }

    movesOut.textContent = stats.moves;
  }

  renderSetup();

  return {
    destroy() {
      stopClock();
      root.remove();
    },
  };
}
