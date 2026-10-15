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
      "Flip two cards at a time and match the pairs. Twelve photos of Phee, and a good memory required.",
    load: () => import("./matching-pairs/game.js"),
  },
];
