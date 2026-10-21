import { createInterfacePlugin, definePlugin } from "./index.ts";
import { setHostApi } from "./internal/host.ts";
import {INTERFACE_PLUGIN_HOST_VERSION} from "./internal/versions.ts";
import type { InterfacePluginDefinition, InterfacePluginHostApi } from "./types/index.ts";

declare global {
    interface Window {
        __dartwicPluginRegistry__?: Record<string, any>;
    }
}

/** Registers an interface plugin definition with the browser plugin host. @dartwic-reference @category Runtime */
export function registerPlugin(pluginDefinition: InterfacePluginDefinition) {
    const plugin = definePlugin(pluginDefinition);
    const pluginId = String(plugin?.id ?? "").trim();

    if (!pluginId) {
        throw new Error("registerPlugin(...) requires a plugin definition with an id.");
    }

    const registry = (window.__dartwicPluginRegistry__ = window.__dartwicPluginRegistry__ || {});
    registry[pluginId] = {
        internalHostVersion: INTERFACE_PLUGIN_HOST_VERSION,
        createPlugin(hostApi: InterfacePluginHostApi) {
            setHostApi(hostApi);
            return createInterfacePlugin(plugin);
        }
    };
}
