import { Queue } from "@fyears/tsqueue";
import chunk from "lodash/chunk";
import flatten from "lodash/flatten";
import type { FileStat } from "webdav";
import {
  getNodeModulesParentFolder,
  shouldIgnoreNodeModulesPath,
} from "./pathFilters";

export type WebdavDirectoryLister = (path: string) => Promise<FileStat[]>;

export const stripLeadingWebdavPath = (path: string): string => {
  let normalized = path;
  while (normalized.startsWith("/..")) {
    normalized = normalized.slice("/..".length);
  }
  return normalized;
};

export const getWebdavRelativePath = (
  fileOrFolderPath: string,
  remoteBaseDir: string
): string => {
  const strippedPath = stripLeadingWebdavPath(fileOrFolderPath);
  if (
    !(
      strippedPath === `/${remoteBaseDir}` ||
      strippedPath.startsWith(`/${remoteBaseDir}/`)
    )
  ) {
    throw Error(
      `"${fileOrFolderPath}" after stripping doesn't starts with "/${remoteBaseDir}/"`
    );
  }
  return strippedPath.slice(`/${remoteBaseDir}/`.length);
};

export const walkWebdavTree = async (
  remoteBaseDir: string,
  listDirectory: WebdavDirectoryLister,
  ignoreNodeModules: boolean,
  validateListing?: (listing: FileStat[]) => void,
  preserveFolder?: (path: string) => void
): Promise<FileStat[]> => {
  const contents: FileStat[] = [];
  const queue = new Queue([`/${remoteBaseDir}`]);
  const chunkSize = 10;

  while (queue.length > 0) {
    const itemsToFetch: string[] = [];
    while (queue.length > 0) {
      itemsToFetch.push(queue.pop()!);
    }

    const listings: FileStat[][] = [];
    for (const paths of chunk(itemsToFetch, chunkSize)) {
      const chunkListings = await Promise.all(
        paths.map(async (path) => {
          const listing = await listDirectory(path);
          const withoutSelf = listing.filter(
            (entry) => stripLeadingWebdavPath(entry.filename) !== path
          );
          validateListing?.(withoutSelf);
          return withoutSelf;
        })
      );
      listings.push(...chunkListings);
    }

    for (const entry of flatten(listings)) {
      const relativePath = getWebdavRelativePath(entry.filename, remoteBaseDir);
      if (shouldIgnoreNodeModulesPath(relativePath, ignoreNodeModules)) {
        const parentFolder = getNodeModulesParentFolder(relativePath);
        if (parentFolder) preserveFolder?.(parentFolder);
        continue;
      }
      contents.push(entry);
      if (entry.type === "directory") {
        queue.push(stripLeadingWebdavPath(entry.filename));
      }
    }
  }

  return contents;
};
