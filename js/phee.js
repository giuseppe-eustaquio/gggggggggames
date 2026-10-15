// Shared access to the Phee photos in images/phee/.
// Used by the header photo (main.js) and by the games.
export const PHEE_DIR = "images/phee/";

// Browsers can't list a folder, so manifest.json (made by
// generate_phee_manifest.py) tells us which files are in images/phee/.
// It's re-read every time, so new photos show up without a page reload.
export async function getPheeImages() {
  const res = await fetch(PHEE_DIR + "manifest.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Manifest returned " + res.status);
  const files = await res.json();
  return files.map((file) => PHEE_DIR + file);
}

// Small version of a photo (made by generate_phee_manifest.py).
// "images/phee/phee7.jpg" -> "images/phee/thumbs/phee7.jpg"
export function pheeThumb(url) {
  const name = url.slice(PHEE_DIR.length).replace(/\.[^.]+$/, "") + ".jpg";
  return PHEE_DIR + "thumbs/" + name;
}
