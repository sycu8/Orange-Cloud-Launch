import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envName = process.env.WRANGLER_ENV || "";
if (envName !== "staging" && envName !== "production") {
  console.error("Set WRANGLER_ENV to staging or production");
  process.exit(1);
}

const toml = readFileSync(path.join(root, "workers/platform/wrangler.toml"), "utf8");
const marker = `[env.${envName}]`;
const start = toml.indexOf(marker);
if (start < 0) {
  console.error(`workers/platform/wrangler.toml is missing ${marker}`);
  process.exit(1);
}
const rest = toml.slice(start + marker.length);
// Stop at the next environment, not at [env.staging.vars] or [env.staging.browser].
const next = rest.search(new RegExp(`\\n\\[env\\.(?!${envName}\\b)`));
const block = next === -1 ? rest : rest.slice(0, next);
const bucket = block
  .split("[[")
  .find((part) => part.includes('binding = "STATIC"'))
  ?.match(/bucket_name = "([^"]+)"/)?.[1];
if (!bucket) {
  console.error(`No STATIC R2 bucket in ${marker}`);
  process.exit(1);
}

const dist = path.join(root, "apps/web/dist");
const files = walk(dist);
if (files.length === 0) {
  console.error("apps/web/dist is empty. Build the web app first.");
  process.exit(1);
}

const contentTypes = {
  css: "text/css; charset=utf-8",
  gif: "image/gif",
  html: "text/html; charset=utf-8",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  map: "application/json",
  mjs: "text/javascript; charset=utf-8",
  png: "image/png",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
  webp: "image/webp",
  woff: "font/woff",
  woff2: "font/woff2",
  xml: "application/xml; charset=utf-8",
};

console.log(`Publishing ${files.length} static files to r2://${bucket}`);
for (const abs of files) {
  const key = path.relative(dist, abs).split(path.sep).join("/");
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  const contentType = contentTypes[ext] ?? "application/octet-stream";
  const cacheControl = key.startsWith("assets/")
    ? "public, max-age=31536000, immutable"
    : "public, max-age=0, must-revalidate";
  const result = spawnSync(
    "npx",
    [
      "wrangler",
      "r2",
      "object",
      "put",
      `${bucket}/${key}`,
      "--file",
      abs,
      "--content-type",
      contentType,
      "--cache-control",
      cacheControl,
      "--remote",
      "--force",
    ],
    {
      cwd: path.join(root, "workers/platform"),
      stdio: "inherit",
      env: { ...process.env, CI: "1" },
    },
  );
  if (result.status !== 0) {
    console.error(`Failed to upload ${key}`);
    process.exit(result.status ?? 1);
  }
}
console.log(`Published static files to ${bucket}`);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const abs = path.join(dir, name);
    if (statSync(abs).isDirectory()) out.push(...walk(abs));
    else out.push(abs);
  }
  return out;
}
