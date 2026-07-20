import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const packageJson = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8")
);
const versions = JSON.parse(readFileSync(join(root, "versions.json"), "utf8"));
const tagName = process.env.GITHUB_REF_NAME;

if (manifest.version !== packageJson.version) {
  throw new Error("manifest.json and package.json must use the same version.");
}

if (versions[manifest.version] !== manifest.minAppVersion) {
  throw new Error(
    "versions.json must map this plugin version to manifest.minAppVersion."
  );
}

if (tagName?.startsWith("v") && tagName.slice(1) !== manifest.version) {
  throw new Error(
    `Release tag ${tagName} does not match plugin version ${manifest.version}.`
  );
}

const releaseDirectory = join(root, "release");
const pluginDirectory = join(releaseDirectory, manifest.id);
const archiveName = `${manifest.id}-v${manifest.version}.zip`;
const archivePath = join(releaseDirectory, archiveName);
const assets = ["main.js", "manifest.json", "styles.css"];

rmSync(releaseDirectory, { recursive: true, force: true });
mkdirSync(pluginDirectory, { recursive: true });

for (const asset of assets) {
  const source = join(root, asset);
  if (!existsSync(source)) {
    throw new Error(`Missing build asset: ${asset}`);
  }
  cpSync(source, join(pluginDirectory, asset));
}

execFileSync("zip", ["-qr", archiveName, manifest.id], {
  cwd: releaseDirectory,
  stdio: "inherit",
});

const checksum = createHash("sha256")
  .update(readFileSync(archivePath))
  .digest("hex");
writeFileSync(
  join(releaseDirectory, `${archiveName}.sha256`),
  `${checksum}  ${archiveName}\n`
);

console.log(`Created release/${archiveName}`);
