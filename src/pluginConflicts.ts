export const REMOTELY_SAVE_PLUGIN_ID = "remotely-save";

type EnabledPluginsLike = { has?: unknown };
type PluginManagerLike = { enabledPlugins?: unknown; disablePlugin?: unknown };
type ObsidianAppLike = { plugins?: unknown };

const pluginManager = (app: unknown): PluginManagerLike | undefined => {
  if (app === null || typeof app !== "object") return undefined;
  const plugins = (app as ObsidianAppLike).plugins;
  return plugins !== null && typeof plugins === "object"
    ? (plugins as PluginManagerLike)
    : undefined;
};

/** Reads Obsidian's runtime plugin registry without depending on private types. */
export const isPluginEnabled = (app: unknown, pluginId: string): boolean => {
  const plugins = pluginManager(app);
  if (!plugins) return false;
  const enabledPlugins = plugins.enabledPlugins;
  if (enabledPlugins === null || typeof enabledPlugins !== "object") return false;
  const has = (enabledPlugins as EnabledPluginsLike).has;
  if (typeof has !== "function") return false;
  return Boolean((has as (id: string) => unknown).call(enabledPlugins, pluginId));
};

export const isRemotelySaveEnabled = (app: unknown): boolean =>
  isPluginEnabled(app, REMOTELY_SAVE_PLUGIN_ID);

/**
 * Disable a conflicting plugin through Obsidian's runtime plugin manager.
 *
 * Obsidian does not expose PluginManager in the public TypeScript API, so the
 * narrow shape is checked at runtime. Returning false means the manager was
 * unavailable, the call failed, or the plugin remained enabled; callers must
 * keep synchronization fail-closed in all of those cases.
 */
export const disableRemotelySave = async (app: unknown): Promise<boolean> => {
  if (!isRemotelySaveEnabled(app)) return true;
  const plugins = pluginManager(app);
  const disablePlugin = plugins?.disablePlugin;
  if (typeof disablePlugin !== "function") return false;
  try {
    await Promise.resolve(
      (disablePlugin as (pluginId: string) => unknown).call(
        plugins,
        REMOTELY_SAVE_PLUGIN_ID
      )
    );
  } catch {
    return false;
  }
  return !isRemotelySaveEnabled(app);
};
