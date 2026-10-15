import { loadCss } from "../shared.js";

const CELL = 22;
const GAP = 2;
const STEP = CELL + GAP;
const BOARD_COLUMNS = 10;
const BOARD_ROWS = 20;
const BOARD_PIXELS_WIDE = BOARD_COLUMNS * CELL + (BOARD_COLUMNS - 1) * GAP;
const BOARD_PIXELS_TALL = BOARD_ROWS * CELL + (BOARD_ROWS - 1) * GAP;
const BOARD_X = (280 - BOARD_PIXELS_WIDE) / 2;
const BOARD_Y = 46;
const CANVAS_WIDTH = 280;
const CANVAS_HEIGHT = 550;
const FALL_INTERVAL = 850;

const SHAPES = [
  { name: "I", cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { name: "O", cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { name: "T", cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  { name: "S", cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  { name: "Z", cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  { name: "J", cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  { name: "L", cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
];

function randomShape() {
  return SHAPES[Math.floor(Math.random() * SHAPES.length)];
}

function rotateCells(cells) {
  const height = Math.max(...cells.map(([, y]) => y)) + 1;
  return cells.map(([x, y]) => [height - 1 - y, x]);
}

function shapeWidth(cells) {
  return Math.max(...cells.map(([x]) => x)) + 1;
}

function shapeHeight(cells) {
  return Math.max(...cells.map(([, y]) => y)) + 1;
}

export async function mount(container) {
  await loadCss(new URL("./game.css", import.meta.url));

  const root = document.createElement("div");
  root.className = "tt";
  root.innerHTML = `
    <div class="tt-layout">
      <div class="tt-play-area">
        <canvas class="tt-board" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}"
          role="img" tabindex="0" aria-label="Turbo Tetris 10 by 20 playfield"></canvas>
      </div>
      <aside class="tt-next" aria-label="Next tetromino">
        <h4>Next</h4>
        <div class="tt-preview" data-preview aria-hidden="true"></div>
        <p data-next-name></p>
      </aside>
    </div>
    <div class="tt-controls" aria-label="Game controls">
      <p class="tt-status" data-status role="status" aria-live="polite"></p>
      <button class="button" type="button" data-left aria-label="Move left">←</button>
      <button class="button" type="button" data-rotate aria-label="Rotate clockwise">↑</button>
      <button class="button" type="button" data-right aria-label="Move right">→</button>
      <button class="button" type="button" data-drop>Drop!</button>
      <button class="button tt-new" type="button" data-new>New game</button>
    </div>
    <p class="tt-instructions">Use ← and → to move, ↑ to rotate, ↓ to move down one row, or Space to drop.</p>`;
  container.append(root);

  const board = root.querySelector(".tt-board");
  const context = board.getContext("2d");
  if (!context) throw new Error("Turbo Tetris could not create a drawing context");

  const status = root.querySelector("[data-status]");
  const preview = root.querySelector("[data-preview]");
  const nextName = root.querySelector("[data-next-name]");
  const moveButtons = [
    root.querySelector("[data-left]"),
    root.querySelector("[data-rotate]"),
    root.querySelector("[data-right]"),
    root.querySelector("[data-drop]"),
  ];

  const overlay = document.createElement("canvas");
  overlay.className = "tt-fall-overlay";
  overlay.setAttribute("aria-hidden", "true");
  document.body.append(overlay);
  const overlayContext = overlay.getContext("2d");
  if (!overlayContext) throw new Error("Turbo Tetris could not create its page overlay");

  let piece = randomShape();
  let pieceCells = piece.cells;
  let next = randomShape();
  let pieceColumn = 0;
  let pieceRow = 0;
  let boardLeft = 0;
  let boardTop = 0;
  let pageTop = 0;
  let scale = 1;
  let maxRow = 0;
  let timer = null;
  let landed = false;

  function drawBlock(x, y, color) {
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(x, y, CELL, CELL, 7);
    context.fill();
    context.strokeStyle = "rgb(255 255 255 / 55%)";
    context.lineWidth = 2;
    context.stroke();
  }

  function drawBoard() {
    const style = getComputedStyle(document.documentElement);
    const surface = style.getPropertyValue("--surface").trim() || "#fff";
    const line = style.getPropertyValue("--line").trim() || "#d5dde5";
    const ink = style.getPropertyValue("--ink").trim() || "#1c2733";
    const bg = style.getPropertyValue("--bg").trim() || "#f2f5f8";

    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    context.fillStyle = surface;
    context.strokeStyle = line;
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(
      BOARD_X - 7,
      BOARD_Y - 7,
      BOARD_PIXELS_WIDE + 14,
      BOARD_PIXELS_TALL + 14,
      12,
    );
    context.fill();
    context.stroke();

    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let column = 0; column < BOARD_COLUMNS; column++) {
        drawBlock(
          BOARD_X + column * STEP,
          BOARD_Y + row * STEP,
          bg,
        );
      }
    }

    context.fillStyle = ink;
    context.font = "600 13px system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText("10 × 20", CANVAS_WIDTH / 2, 26);
  }

  function drawNext() {
    const cells = new Set(next.cells.map(([x, y]) => `${x},${y}`));
    preview.replaceChildren();
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const cell = document.createElement("span");
        if (cells.has(`${x},${y}`)) cell.className = "is-filled";
        preview.append(cell);
      }
    }
    nextName.textContent = `${next.name} tetromino`;
  }

  function resizeOverlay() {
    const ratio = window.devicePixelRatio || 1;
    overlay.width = Math.round(window.innerWidth * ratio);
    overlay.height = Math.round(window.innerHeight * ratio);
    overlay.style.width = `${window.innerWidth}px`;
    overlay.style.height = `${window.innerHeight}px`;
    overlayContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawPiece();
  }

  function drawPiece() {
    if (!overlayContext) return;
    overlayContext.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const style = getComputedStyle(document.documentElement);
    const accent = style.getPropertyValue("--accent").trim() || "#2f6fed";
    const cell = CELL * scale;
    const step = STEP * scale;
    const x = boardLeft + (BOARD_X + pieceColumn * STEP) * scale - window.scrollX;
    const y = pageTop + pieceRow * step - window.scrollY;

    for (const [column, row] of pieceCells) {
      const blockX = x + column * step;
      const blockY = y + row * step;
      overlayContext.fillStyle = accent;
      overlayContext.beginPath();
      overlayContext.roundRect(blockX, blockY, cell, cell, Math.max(2, 7 * scale));
      overlayContext.fill();
      overlayContext.strokeStyle = "rgb(255 255 255 / 55%)";
      overlayContext.lineWidth = Math.max(1, 2 * scale);
      overlayContext.stroke();
    }

    board.setAttribute(
      "aria-label",
      `Turbo Tetris 10 by 20 playfield. ${piece.name} tetromino, ${
        shapeWidth(pieceCells)
      } columns by ${shapeHeight(pieceCells)} rows, ${
        landed
          ? "reached the bottom; game over"
          : `at column ${pieceColumn + 1}, page row ${pieceRow + 1}`
      }.`,
    );
  }

  function measurePage() {
    const rect = board.getBoundingClientRect();
    scale = rect.width / CANVAS_WIDTH;
    boardLeft = rect.left + window.scrollX;
    pageTop = rect.top + window.scrollY + BOARD_Y * scale;
    const pageHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    );
    const pieceHeight = (shapeHeight(pieceCells) - 1) * STEP * scale + CELL * scale;
    maxRow = Math.max(
      0,
      Math.floor((pageHeight - pageTop - pieceHeight) / (STEP * scale)),
    );
  }

  function finish() {
    if (landed) return;
    landed = true;
    clearInterval(timer);
    timer = null;
    moveButtons.forEach((button) => (button.disabled = true));
    status.textContent = "Game over.";
    drawPiece();
  }

  function tick() {
    if (landed) return;
    pieceRow = Math.min(maxRow, pieceRow + 1);
    drawPiece();
    if (pieceRow >= maxRow) finish();
  }

  function startGame() {
    clearInterval(timer);
    piece = randomShape();
    pieceCells = piece.cells;
    pieceColumn = Math.floor((BOARD_COLUMNS - shapeWidth(pieceCells)) / 2);
    pieceRow = 0;
    landed = false;
    status.textContent = "";
    moveButtons.forEach((button) => (button.disabled = false));
    next = randomShape();
    drawNext();
    measurePage();
    drawBoard();
    drawPiece();
    timer = setInterval(tick, FALL_INTERVAL);
  }

  function move(amount) {
    if (landed) return;
    pieceColumn = Math.max(
      0,
      Math.min(BOARD_COLUMNS - shapeWidth(pieceCells), pieceColumn + amount),
    );
    drawPiece();
  }

  function rotate() {
    if (landed) return;
    pieceCells = rotateCells(pieceCells);
    pieceColumn = Math.min(
      pieceColumn,
      BOARD_COLUMNS - shapeWidth(pieceCells),
    );
    measurePage();
    pieceRow = Math.min(pieceRow, maxRow);
    drawPiece();
    if (pieceRow >= maxRow) finish();
  }

  function drop() {
    if (landed) return;
    pieceRow = maxRow;
    drawPiece();
    finish();
  }

  const onKeyDown = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest("input, textarea, select, [contenteditable]")
    )
      return;
    if (event.key === "ArrowLeft") move(-1);
    else if (event.key === "ArrowRight") move(1);
    else if (event.key === "ArrowUp") rotate();
    else if (event.key === "ArrowDown") tick();
    else if (event.key === " " && !(target instanceof HTMLButtonElement)) drop();
    else return;
    event.preventDefault();
  };
  const onScroll = () => drawPiece();
  const onResize = () => {
    measurePage();
    resizeOverlay();
  };

  root.querySelector("[data-left]").addEventListener("click", () => move(-1));
  root.querySelector("[data-rotate]").addEventListener("click", rotate);
  root.querySelector("[data-right]").addEventListener("click", () => move(1));
  root.querySelector("[data-drop]").addEventListener("click", drop);
  root.querySelector("[data-new]").addEventListener("click", startGame);
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);

  resizeOverlay();
  startGame();

  return {
    destroy() {
      clearInterval(timer);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      overlay.remove();
      root.remove();
    },
  };
}
