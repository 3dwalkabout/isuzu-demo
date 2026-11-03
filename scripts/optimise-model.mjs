/**
 * Builds the web-ready vehicle model from a source GLB.
 *
 * Usage: node scripts/optimise-model.mjs <source.glb> [options]
 *
 * Options:
 *   --out <path>           output file, default public/models/dmax.glb
 *   --texture-size <px>    longest side for textures, default 2048
 *   --simplify <ratio>     triangle ratio between 0 and 1, default 1 (off)
 *
 * Steps: downscale oversized textures, compress with gltfpack (Meshopt and
 * quantisation, names and materials kept), then check that every source node
 * name survived. The source file is never modified and never copied into the repo.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { PNG } from "pngjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = { source: "", out: join(root, "public/models/dmax.glb"), textureSize: 2048, simplify: 1 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out") args.out = resolve(argv[++i]);
    else if (arg === "--texture-size") args.textureSize = Number(argv[++i]);
    else if (arg === "--simplify") args.simplify = Number(argv[++i]);
    else if (arg.startsWith("--")) throw new Error(`unknown option ${arg}`);
    else args.source = resolve(arg);
  }
  if (!args.source) throw new Error("usage: node scripts/optimise-model.mjs <source.glb> [options]");
  if (!(args.textureSize >= 64)) throw new Error("--texture-size must be a number of at least 64");
  if (!(args.simplify > 0 && args.simplify <= 1)) throw new Error("--simplify must be above 0 and at most 1");
  return args;
}

/** Area-averages a normal map down to the target size and renormalises each vector. */
function downscaleNormalMap(png, size) {
  const scale = size / Math.max(png.width, png.height);
  const width = Math.max(1, Math.round(png.width * scale));
  const height = Math.max(1, Math.round(png.height * scale));
  const out = new PNG({ width, height });
  const xr = png.width / width;
  const yr = png.height / height;

  for (let y = 0; y < height; y++) {
    const y0 = y * yr;
    const y1 = y0 + yr;
    for (let x = 0; x < width; x++) {
      const x0 = x * xr;
      const x1 = x0 + xr;
      let nx = 0;
      let ny = 0;
      let nz = 0;
      for (let sy = Math.floor(y0); sy < Math.min(Math.ceil(y1), png.height); sy++) {
        const wy = Math.min(sy + 1, y1) - Math.max(sy, y0);
        for (let sx = Math.floor(x0); sx < Math.min(Math.ceil(x1), png.width); sx++) {
          const w = wy * (Math.min(sx + 1, x1) - Math.max(sx, x0));
          const i = (sy * png.width + sx) * 4;
          nx += (png.data[i] / 127.5 - 1) * w;
          ny += (png.data[i + 1] / 127.5 - 1) * w;
          nz += (png.data[i + 2] / 127.5 - 1) * w;
        }
      }
      const len = Math.hypot(nx, ny, nz) || 1;
      const o = (y * width + x) * 4;
      out.data[o] = Math.round(((nx / len) * 0.5 + 0.5) * 255);
      out.data[o + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255);
      out.data[o + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
      out.data[o + 3] = 255;
    }
  }
  return out;
}

/** Downscales every PNG texture above the size limit, textures are only used as normal maps here. */
async function prepareSource(source, textureSize, tmp) {
  // register every extension so material settings such as glass transmission are kept on write
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(source);
  for (const texture of doc.getRoot().listTextures()) {
    if (texture.getMimeType() !== "image/png") continue;
    const image = texture.getImage();
    if (!image) continue;
    const png = PNG.sync.read(Buffer.from(image));
    if (Math.max(png.width, png.height) <= textureSize) continue;
    const isNormal = doc
      .getRoot()
      .listMaterials()
      .some((m) => m.getNormalTexture() === texture);
    if (!isNormal) throw new Error(`texture ${texture.getName()} is oversized and is not a normal map, add a resize path for it`);
    const small = downscaleNormalMap(png, textureSize);
    texture.setImage(new Uint8Array(PNG.sync.write(small)));
    console.log(`texture ${texture.getName()}: ${png.width}x${png.height} -> ${small.width}x${small.height}`);
  }
  const prepared = join(tmp, "prepared.glb");
  await io.write(prepared, doc);
  return prepared;
}

function runGltfpack(input, output, simplify) {
  const cli = join(root, "node_modules/gltfpack/cli.js");
  const flags = ["-kn", "-km", "-ke", "-vp", "14", "-vn", "10", "-cc"];
  if (simplify < 1) flags.push("-si", String(simplify));
  const result = spawnSync(process.execPath, [cli, "-i", input, "-o", output, ...flags], { stdio: "inherit" });
  if (result.status !== 0) throw new Error("gltfpack failed");
}

function readJson(path) {
  const buf = readFileSync(path);
  return JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString("utf8"));
}

function checkNames(sourceJson, outputJson) {
  const out = new Set(outputJson.nodes.map((n) => n.name));
  const missing = sourceJson.nodes.map((n) => n.name).filter((name) => !out.has(name));
  if (missing.length) throw new Error(`nodes missing from output: ${missing.join(", ")}`);
  const mats = new Set(outputJson.materials.map((m) => m.name));
  const lostMats = sourceJson.materials.map((m) => m.name).filter((name) => !mats.has(name));
  if (lostMats.length) throw new Error(`materials missing from output: ${lostMats.join(", ")}`);
}

const mb = (bytes) => (bytes / 1e6).toFixed(1);

const args = parseArgs(process.argv.slice(2));
const tmp = mkdtempSync(join(tmpdir(), "dmax-"));
try {
  const prepared = await prepareSource(args.source, args.textureSize, tmp);
  mkdirSync(dirname(args.out), { recursive: true });
  runGltfpack(prepared, args.out, args.simplify);
  checkNames(readJson(args.source), readJson(args.out));
  const size = statSync(args.out).size;
  const gzip = gzipSync(readFileSync(args.out)).length;
  console.log(`source ${mb(statSync(args.source).size)} MB -> ${args.out}`);
  console.log(`output ${mb(size)} MB, ${mb(gzip)} MB gzipped`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
