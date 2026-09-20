import { defineConfig } from 'vite';
import { createReadStream, existsSync, readdirSync } from 'node:fs';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// MediaPipe's vision runtime is a folder of .js/.wasm files that
// FilesetResolver loads BY NAME from a base path it is handed. That rules out
// the normal Vite asset pipeline, which hashes filenames, and publicDir is
// already spoken for by ../data. So the folder is served as-is in dev and
// copied verbatim on build.
//
// The alternative is pointing FilesetResolver at a CDN, which works right up
// until the piece is standing in a gallery on a guest network, or no network.
const WASM_DIR = path.resolve(HERE, 'node_modules/@mediapipe/tasks-vision/wasm');
const WASM_ROUTE = '/mediapipe-wasm/';

function mediapipeWasm() {
  return {
    name: 'mediapipe-wasm',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0];
        if (!url.startsWith(WASM_ROUTE)) return next();
        const file = path.join(WASM_DIR, url.slice(WASM_ROUTE.length));
        // never let a crafted path climb out of the wasm folder
        if (!file.startsWith(WASM_DIR) || !existsSync(file)) return next();
        res.setHeader('Content-Type',
          file.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        createReadStream(file).pipe(res);
      });
    },
    async closeBundle() {
      await cp(WASM_DIR, path.resolve(HERE, 'dist/mediapipe-wasm'), { recursive: true });
    },
  };
}

// species/photos/ holds one portrait per bird, named by slug. Two things make
// it awkward for the normal asset pipeline: the files arrive after the code
// does (so nothing can import them by name), and they come in whatever format
// the photographer supplied, so the extension is not knowable up front.
//
// Both are solved by a manifest. The server publishes slug -> filename, the
// card asks for the manifest and never guesses an extension, and the identical
// route exists in dev and in the built bundle. Re-read per request rather than
// cached, so dropping a new photo in and reloading is enough - restarting the
// dev server to see a picture appear is the kind of friction that stops a
// folder from ever being filled in.
const PHOTO_DIR = path.resolve(HERE, '../species/photos');
const PHOTO_ROUTE = '/species-photos/';
const PHOTO_EXT = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.avif': 'image/avif',
};

function photoManifest() {
  if (!existsSync(PHOTO_DIR)) return {};
  const out = {};
  for (const name of readdirSync(PHOTO_DIR)) {
    const ext = path.extname(name).toLowerCase();
    if (!PHOTO_EXT[ext]) continue;                  // README.md, CREDITS.json
    out[path.basename(name, ext)] = name;
  }
  return out;
}

function speciesPhotos() {
  return {
    name: 'species-photos',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url || '').split('?')[0]);
        if (!url.startsWith(PHOTO_ROUTE)) return next();
        const rest = url.slice(PHOTO_ROUTE.length);
        if (rest === 'index.json') {
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify(photoManifest()));
        }
        const file = path.join(PHOTO_DIR, rest);
        // never let a crafted path climb out of the photo folder
        if (!file.startsWith(PHOTO_DIR) || !existsSync(file)) return next();
        const type = PHOTO_EXT[path.extname(file).toLowerCase()];
        if (!type) return next();
        res.setHeader('Content-Type', type);
        createReadStream(file).pipe(res);
      });
    },
    async closeBundle() {
      const manifest = photoManifest();
      const dest = path.resolve(HERE, 'dist/species-photos');
      await mkdir(dest, { recursive: true });
      for (const name of Object.values(manifest)) {
        await cp(path.join(PHOTO_DIR, name), path.join(dest, name));
      }
      await writeFile(path.join(dest, 'index.json'), JSON.stringify(manifest));
    },
  };
}


// ../data holds analyze_call.py output (index.json, plus call.wav and
// features.json per species). Serving it as publicDir means fetch('/index.json')
// just works in dev, exactly as in the jazz sculpture.
export default defineConfig({
  publicDir: '../data',
  plugins: [mediapipeWasm(), speciesPhotos()],
  server: { port: 5176 },
});
