const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

export const STORE_ASSETS = ["main.js", "manifest.json", "styles.css"];

export function releaseTagFromEnvironment(environment) {
  return environment.GITHUB_REF_TYPE === "tag"
    ? environment.GITHUB_REF_NAME
    : undefined;
}

export function validateReleaseContract({
  manifest,
  packageJson,
  versions,
  tagName,
}) {
  if (!VERSION_PATTERN.test(manifest.version)) {
    throw new Error("Plugin version must use the x.y.z format.");
  }
  if (manifest.version !== packageJson.version) {
    throw new Error(
      "manifest.json and package.json must use the same version."
    );
  }
  if (versions[manifest.version] !== manifest.minAppVersion) {
    throw new Error(
      "versions.json must map this plugin version to manifest.minAppVersion."
    );
  }
  if (tagName && tagName !== manifest.version) {
    throw new Error(
      `Release tag ${tagName} must exactly match plugin version ${manifest.version}.`
    );
  }
}

export function validateStoreReviewAssets({ manifest, javascript, stylesheet }) {
  if (/createElement\(\s*["']script["']\s*\)/.test(javascript)) {
    throw new Error(
      "Bundled JavaScript must not dynamically create script elements."
    );
  }
  if (/!important\b/.test(stylesheet)) {
    throw new Error("Plugin stylesheet must not use !important.");
  }
  if (/github\.com\/[^/]+\/[^/]+\/?$/.test(manifest.authorUrl ?? "")) {
    throw new Error(
      "manifest.authorUrl must point to a profile or organization, not a repository."
    );
  }
}
