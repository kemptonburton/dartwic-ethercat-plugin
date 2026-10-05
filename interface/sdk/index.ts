import type {
    InterfaceContributionEntry,
    InterfaceContributions,
    InterfacePluginDefinition,
    InterfacePluginRegistrar,
    MaterializedInterfacePlugin,
    ModuleConnectionDefinition,
    ModuleConnectionPresentation,
    ModuleUiDefinition,
    PopupUiDefinition,
    ResourceContributionDefinition,
    SchematicNodeContributionDefinition,
    SettingsPanelDefinition,
    TaskUiDefinition,
    ValueFormatDefinition,
} from "./types/index.ts";
export {createNotificationClient} from "./notifications/index.ts";
export {createStorageClient, installationPath, instancePath, workspacePath, projectPath, projectSettingsPath, projectRuntimePath, projectCachePath} from './storage/index.ts';
export {createWorkspaceAssetClient, workspaceAssetPath, WORKSPACE_ASSET_ROOT} from './assets/index.ts';
export type {NotificationSeverity, SettingsDestination, LocalNotification, SettingsIssue, LocalNotificationClient} from "./notifications/index.ts";

const EMPTY_CONTRIBUTIONS = (): InterfaceContributions => ({
    valueFormats: [],
    taskUis: [],
    moduleUis: [],
    resources: [],
    schematicNodes: [],
    settingsPanels: [],
    popupUis: [],
});

function assertLocalId(value: string, kind: string): string {
    const id = String(value ?? "").trim();
    if (!id) {
        throw new Error(`A local ${kind} id is required.`);
    }
    if (/[./\\]/u.test(id)) {
        throw new Error(`Local ${kind} id '${id}' must not contain '.', '/', or '\\'.`);
    }
    return id;
}

function materializePlugin(definition: InterfacePluginDefinition): MaterializedInterfacePlugin {
    const pluginId = String(definition?.id ?? "").trim();
    if (!pluginId) {
        throw new Error("definePlugin(...) requires an id.");
    }
    if (typeof definition.register !== "function") {
        throw new Error(`Interface plugin '${pluginId}' must provide register(registry).`);
    }

    const contributions = EMPTY_CONTRIBUTIONS();
    const taskCards: MaterializedInterfacePlugin["taskCards"] = {};
    const taskEditors: MaterializedInterfacePlugin["taskEditors"] = {};
    const moduleUis: MaterializedInterfacePlugin["moduleUis"] = {};
    const resources: MaterializedInterfacePlugin["resources"] = [];
    const schematicNodes: MaterializedInterfacePlugin["schematicNodes"] = [];
    const settingsPanels: MaterializedInterfacePlugin["settingsPanels"] = [];
    const popupUis: MaterializedInterfacePlugin["popupUis"] = {};
    const valueFormats: MaterializedInterfacePlugin["valueFormats"] = {};
    const categoryIds = new Map<keyof InterfaceContributions, Set<string>>();
    const resourceNames = new Set<string>();

    function addEntry(
        category: keyof InterfaceContributions,
        localIdValue: string,
        nameValue: string,
        details: Record<string, unknown> = {},
    ): string {
        const localId = assertLocalId(localIdValue, String(category));
        const canonicalId = `${pluginId}.${localId}`;
        const ids = categoryIds.get(category) ?? new Set<string>();
        if (ids.has(canonicalId)) {
            throw new Error(`Duplicate ${category} contribution '${canonicalId}'.`);
        }
        ids.add(canonicalId);
        categoryIds.set(category, ids);
        const entry: InterfaceContributionEntry = {
            id: canonicalId,
            name: String(nameValue ?? "").trim() || localId,
            ...details,
        };
        contributions[category].push(entry);
        return canonicalId;
    }

    const registry: InterfacePluginRegistrar = {
        addValueFormat(value: ValueFormatDefinition) {
            const id = addEntry("valueFormats", value.id, value.name);
            if (!/^[a-z0-9][a-z0-9_.-]*$/.test(id)) throw new Error(`Value format '${id}' must use lowercase letters, digits, dots, underscores, or hyphens.`);
            if (typeof value.format !== "function") throw new Error(`Value format '${id}' needs format(value).`);
            valueFormats[id] = {...value, id};
            return id;
        },
        addTaskUi(value: TaskUiDefinition) {
            const id = addEntry("taskUis", value.id, value.name);
            if (!value.card && !value.editor) {
                throw new Error(`Task UI '${id}' must provide a card or editor component.`);
            }
            if (value.card) taskCards[id] = {taskType: id, component: value.card};
            if (value.editor) taskEditors[id] = {taskType: id, component: value.editor};
            return id;
        },
        addModuleUi(value: ModuleUiDefinition) {
            const id = addEntry("moduleUis", value.id, value.name);
            if (!value.icon && !value.panel) {
                throw new Error(`Module UI '${id}' must provide an icon or panel component.`);
            }
            moduleUis[id] = {...value, id};
            return id;
        },
        addResource(value: ResourceContributionDefinition) {
            const runtimeName = String(value.resourceName ?? value.id ?? "").trim();
            if (!runtimeName || runtimeName === "." || runtimeName === ".." || !/^[A-Za-z0-9_-]+$/u.test(runtimeName)) {
                throw new Error(`Resource runtime name '${runtimeName}' must be a safe single path segment.`);
            }
            if (resourceNames.has(runtimeName)) {
                throw new Error(`Duplicate resource runtime name '${runtimeName}'.`);
            }
            resourceNames.add(runtimeName);
            const id = addEntry("resources", value.id, value.name, {type: value.type, resourceName: runtimeName});
            if (!value.icon) {
                throw new Error(`Resource '${id}' must provide an icon component.`);
            }
            if (value.type === "component" && !value.component) {
                throw new Error(`Component resource '${id}' must provide a component.`);
            }
            resources.push({...value, resourceName: runtimeName, name: runtimeName});
            return id;
        },
        addSchematicNode(value: SchematicNodeContributionDefinition) {
            const id = addEntry("schematicNodes", value.id, value.name);
            schematicNodes.push({...value, type: id});
            return id;
        },
        addSettingsPanel(value: SettingsPanelDefinition) {
            const id = addEntry("settingsPanels", value.id, value.name);
            settingsPanels.push({...value, id});
            return id;
        },
        addPopupUi(value: PopupUiDefinition) {
            const id = addEntry("popupUis", value.id, value.name, {
                requestType: value.requestType,
                resultType: value.resultType,
                requestSchema: value.requestSchema,
                resultSchema: value.resultSchema,
            });
            if (typeof value.component !== "function") {
                throw new Error(`Popup UI '${id}' must provide a component.`);
            }
            popupUis[id] = {...value, id};
            return id;
        },
    };

    definition.register(registry);

    return {
        id: pluginId,
        name: String(definition.name ?? "").trim() || pluginId,
        taskTypes: Object.keys({...taskCards, ...taskEditors}),
        taskCards,
        taskEditors,
        moduleUis,
        resources,
        schematicNodes,
        settingsPanels,
        popupUis,
        valueFormats,
        contributions: {interface: contributions},
    };
}

/** Defines an interface plugin without registering it in the browser host. @dartwic-reference @category Plugin Registration */
export function definePlugin(plugin: InterfacePluginDefinition): InterfacePluginDefinition {
    if (!plugin || typeof plugin !== "object") {
        throw new Error("definePlugin(...) requires a plugin definition.");
    }
    return plugin;
}

/** Materializes and validates all contributions registered by a plugin. @dartwic-reference @category Plugin Registration */
export function createInterfacePlugin(plugin: InterfacePluginDefinition): MaterializedInterfacePlugin {
    return materializePlugin(definePlugin(plugin));
}

/** Returns the normalized contribution inventory produced by a plugin. @dartwic-reference @category Plugin Registration */
export function getInterfacePluginContributions(plugin: InterfacePluginDefinition): {interface: InterfaceContributions} {
    return createInterfacePlugin(plugin).contributions;
}

export type {
    InterfaceContributions,
    InterfacePluginDefinition,
    InterfacePluginHostApi,
    InterfacePluginRegistrar,
    MaterializedInterfacePlugin,
    ModuleConnectionDefinition,
    ModuleConnectionPresentation,
    ModuleUiDefinition,
    PopupUiDefinition,
    ResourceContributionDefinition,
    SchematicNodeContributionDefinition,
    SettingsPanelDefinition,
    TaskUiDefinition,
} from "./types/index.ts";
export type {
    ResourceComponentProps,
    ResourceDefinition,
    ResourceErrorState,
    SaveResourceContentOptions,
} from "./resources/types.ts";
