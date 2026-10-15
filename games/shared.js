// Small helpers shared by the Playground and every game.

// Add a stylesheet once. Resolves when it has loaded (or after a short
// timeout), so a slow or missing file can never stop a game from starting.
export function loadCss(url) {
  const href = new URL(url, document.baseURI).href;
  const already = [...document.querySelectorAll('link[rel="stylesheet"]')].some(
    (link) => link.href === href,
  );
  if (already) return Promise.resolve();

  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", resolve, { once: true });
    setTimeout(resolve, 3000);
    document.head.append(link);
  });
}

// Returns a shuffled copy (Fisher-Yates).
export function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
