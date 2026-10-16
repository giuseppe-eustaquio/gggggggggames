// Every game in the Playground is listed here.
//
// To add a game:
//   1. Create games/<id>/game.js that exports  mount(container)  and returns
//      { destroy() }  (see games/matching-pairs/game.js for an example).
//   2. Add an entry below.
//
// Games are loaded on demand, so a heavy game (for example one that uses
// Phaser) only downloads its code when someone actually opens it.
export const games = [
  {
    id: "matching-pairs",
    title: "Matching Pairs",
    blurb:
      "Flip the cards, find every matching pair, and see how sharp your memory really is.",
    load: () => import("./matching-pairs/game.js"),
  },
  {
    id: "turbo-tetris",
    title: "Turbo Tetris",
    blurb:
      "Rotate falling blocks, line them up, and keep the game going for a high score.",
    load: () => import("./turbo-tetris/game.js"),
  },
  {
    id: "one-player-chess",
    title: "One-Player Chess",
    blurb:
      "Choose your side, set a time control, and put your chess skills to the test.",
    load: () => import("./one-player-chess/game.js"),
  },
];
