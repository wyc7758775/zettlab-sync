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
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { STORE_ASSETS, validateReleaseContract } from "./release-contract.mjs";

export function packageRelease({
  root = process.cwd(),
  tagName = process.env.GITHUB_REF_NAME,
} = {}) {
  const manifest = JSON.parse(
    readFileSync(join(root, "manifest.json"), "utf8")
  );
  const packageJson = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8")
  );
  const versions = JSON.parse(
    readFileSync(join(root, "versions.json"), "utf8")
  );
  validateReleaseContract({ manifest, packageJson, versions, tagName });

  const releaseDirectory = join(root, "release");
  const pluginDirectory = join(releaseDirectory, manifest.id);
  const archiveName = `${manifest.id}-v${manifest.version}.zip`;
  const archivePath = join(releaseDirectory, archiveName);

  rmSync(releaseDirectory, { recursive: true, force: true });
  mkdirSync(pluginDirectory, { recursive: true });

  for (const asset of STORE_ASSETS) {
    const source = join(root, asset);
    if (!existsSync(source)) throw new Error(`Missing build asset: ${asset}`);
    cpSync(source, join(releaseDirectory, asset));
    cpSync(source, join(pluginDirectory, asset));
  }

  execFileSync("zip", ["-qr", archiveName, manifest.id], {
    cwd: releaseDirectory,
    stdio: "inherit",
  });
  rmSync(pluginDirectory, { recursive: true, force: true });

  const checksum = createHash("sha256")
    .update(readFileSync(archivePath))
    .digest("hex");
  writeFileSync(
    join(releaseDirectory, `${archiveName}.sha256`),
    `${checksum}  ${archiveName}\n`
  );
  return { releaseDirectory, archiveName, storeAssets: STORE_ASSETS };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const result = packageRelease();
  console.log(
    `Created ${dirname(result.releaseDirectory)}/release/${result.archiveName}`
  );
}
