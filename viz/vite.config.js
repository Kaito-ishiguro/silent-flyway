import { defineConfig } from 'vite';

// ../data holds analyze_call.py output (index.json, plus call.wav and
// features.json per species). Serving it as publicDir means fetch('/index.json')
// just works in dev, exactly as in the jazz sculpture.
export default defineConfig({
  publicDir: '../data',
  server: { port: 5176 },
});
