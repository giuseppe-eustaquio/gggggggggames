# gggggggggames

A plain HTML/CSS/JS site with a Playground of games.

## Run it locally

```bash
python3 serve.py        # http://localhost:8000
```

`serve.py` is a small dev server. It also refreshes the Phee photo list
(`images/phee/manifest.json`) and the thumbnails (`images/phee/thumbs/`)
whenever you add or remove photos.

Thumbnails need Pillow once: `pip install pillow`. Without it everything
still works, the games just load the full-size photos.

## Git hook (one time per clone)

```bash
git config core.hooksPath .githooks
```

Before every commit the hook refreshes the manifest and thumbnails and adds
them to the commit, so the deployed site always matches `images/phee/`.

## Project layout

```
index.html              the page
css/style.css           site styles
js/main.js              header photo, theme, accent colour, menu, ...
js/phee.js              shared helper for the Phee photos
games/registry.js       the list of games (add new games here)
games/playground.js     the Playground: game list + opens a game
games/shared.js         helpers games can use (loadCss, shuffle)
games/<id>/game.js      one folder per game
games/<id>/game.css     that game's styles
```

## Adding a game

1. Make `games/<id>/game.js` that exports `mount(container)` and returns
   `{ destroy() }`. Build the game inside `container`; undo everything
   (timers, listeners, a Phaser instance, ...) in `destroy()`.
2. Add an entry to `games/registry.js` with an `id`, `title`, `blurb` and
   `load: () => import("./<id>/game.js")`.

Games are loaded only when opened, and each game decides what it uses.
Simple games can use plain DOM and CSS (like Matching Pairs). A game that
needs Phaser can load it from its own `mount()` without affecting the rest.

Each game has its own link: `#playground/<id>`.
