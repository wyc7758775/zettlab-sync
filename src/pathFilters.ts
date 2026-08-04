const normalizedSegments = (path: string): string[] =>
  path.replace(/\\/g, "/").split("/").filter(Boolean);

export const getNodeModulesParentFolder = (
  path: string
): string | undefined => {
  const segments = normalizedSegments(path);
  const nodeModulesIndex = segments.indexOf("node_modules");
  if (nodeModulesIndex < 0) return undefined;
  return nodeModulesIndex === 0
    ? ""
    : `${segments.slice(0, nodeModulesIndex).join("/")}/`;
};

export const isNodeModulesPath = (path: string): boolean =>
  getNodeModulesParentFolder(path) !== undefined;

export const shouldIgnoreNodeModulesPath = (
  path: string,
  ignoreNodeModules: boolean
): boolean => ignoreNodeModules && isNodeModulesPath(path);
