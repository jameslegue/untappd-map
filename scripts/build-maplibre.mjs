// Compiles MapLibre for older Safari, runs on install and before every build.
//
// MapLibre 6 ships modern JavaScript (class static blocks need Safari 16.4+) and
// loads its worker as an ES module resolved next to its own file, which Next's
// bundling breaks. So, with esbuild:
//   - .generated/maplibre-gl.mjs: the main library compiled down; next.config
//     points `import "maplibre-gl"` here. (Done here rather than via Next's
//     transpilePackages, which Vercel's build cache can skip - a cached,
//     untranspiled copy went to production once.)
//   - public/maplibre/maplibre-gl-worker.<hash>.cjs: the worker, compiled down
//     as a classic script (MapLibre starts a classic worker for a .cjs URL),
//     served as JavaScript via next.config headers.
import { build } from "esbuild";
import { createHash } from "crypto";
import fs from "fs";

const target = ["safari15", "ios15", "chrome90", "firefox90", "edge90"];

fs.mkdirSync(".generated", { recursive: true });
await build({
  entryPoints: ["node_modules/maplibre-gl/dist/maplibre-gl.mjs"],
  outfile: ".generated/maplibre-gl.mjs",
  bundle: true,
  format: "esm",
  target,
  legalComments: "inline",
  logLevel: "warning",
});

// The worker gets a content-hashed name, so a browser can never run a stale
// copy (Safari kept one served with the wrong Content-Type across reloads).
// useMap reads the name from .generated/maplibre-worker.json
const worker = await build({
  entryPoints: ["node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs"],
  write: false,
  bundle: true,
  format: "iife",
  target,
  minify: true,
  legalComments: "inline",
  logLevel: "warning",
});
const code = worker.outputFiles[0].contents;
const hash = createHash("sha256").update(code).digest("hex").slice(0, 12);
const name = `maplibre-gl-worker.${hash}.cjs`;
fs.rmSync("public/maplibre", { recursive: true, force: true });
fs.mkdirSync("public/maplibre", { recursive: true });
fs.writeFileSync(`public/maplibre/${name}`, code);
fs.writeFileSync(".generated/maplibre-worker.json", JSON.stringify({ url: `/maplibre/${name}` }));
console.log(`worker: /maplibre/${name}`);
