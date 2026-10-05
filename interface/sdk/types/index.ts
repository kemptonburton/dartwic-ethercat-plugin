import type { ModuleConfigDefinition } from "../module-configs/types.ts";
import type { PluginSettingsDefinition } from "../plugin-settings/types.ts";
import type { ResourceDefinition } from "../resources/types.ts";
import type { SchematicNodeDefinition } from "../schematic-nodes/types.ts";
import type { TaskCardDefinition, TaskConfigDefinition } from "../tasks/types.ts";

/** Shared local identity and display name for plugin contributions. @dartwic-reference @category Plugin Registration */
export interface NamedContribution {
    id: string;
    name: string;
}

/** Registers task card and editor components under one task type. @dartwic-reference @category Tasks */
export interface TaskUiDefinition extends NamedContribution {
    card?: TaskCardDefinition["component"];
    editor?: TaskConfigDefinition["component"];
}

/** Optional live connection presentation used by module headers and resource navigation.  @dartwic-reference @category Module Configuration */
export interface ModuleConnectionPresentation {
    channel: string;
    label?: string;
    endpoint?: string;
    connectedValue?: string | number | boolean;
}

/** Static or instance-derived live connection presentation for a module. @dartwic-reference @category Module Configuration */
export type ModuleConnectionDefinition = ModuleConnectionPresentation | ((context: {
    instanceConfig: Record<string, any>;
    instanceName: string;
}) => ModuleConnectionPresentation | null);

/** Registers icon and panel components for a module type. @dartwic-reference @category Module Configuration */
export interface ModuleUiDefinition extends NamedContribution {
    icon?: (props: {className?: string; size?: number; "aria-hidden"?: boolean}) => any;
    panel?: ModuleConfigDefinition["component"];
    /** Opts this module type into shared live connection status presentation. */
    connection?: ModuleConnectionDefinition;
}

/** Registers a resource type through the plugin registrar. @dartwic-reference @category Resources */
export interface ResourceContributionDefinition extends ResourceDefinition {
    id: string;
    name: string;
}

/** Registers a schematic node under a plugin-qualified type. @dartwic-reference @category Schematic Nodes */
export interface SchematicNodeContributionDefinition extends Omit<SchematicNodeDefinition, "type">, NamedContribution {}

/** Registers a plugin settings panel. @dartwic-reference @category Plugin Settings */
export interface SettingsPanelDefinition extends NamedContribution {
    component: PluginSettingsDefinition["component"];
}

/** A named, host-modal workflow which receives one or more merge-compatible backend requests.  @dartwic-reference @category Plugin Registration */
export interface PopupUiDefinition extends NamedContribution {
    component: (props: {
        requests: Array<Record<string, any>>;
        complete(requestId: string, result: unknown): Promise<unknown>;
        dismiss(requestId: string, result?: unknown): Promise<unknown>;
    }) => any;
    /** Human-readable request contract shown in generated plugin documentation. */
    requestType?: string;
    /** Human-readable completion-result contract shown in generated plugin documentation. */
    resultType?: string;
    /** Optional JSON Schema describing each backend request payload. */
    requestSchema?: Record<string, unknown>;
    /** Optional JSON Schema describing the result returned for each completed request. */
    resultSchema?: Record<string, unknown>;
}

/** Focused registry supplied to an interface plugin's `register` callback. @dartwic-reference @category Plugin Registration */
export interface InterfacePluginRegistrar {
    addValueFormat(definition: ValueFormatDefinition): string;
    addTaskUi(definition: TaskUiDefinition): string;
    addModuleUi(definition: ModuleUiDefinition): string;
    addResource(definition: ResourceContributionDefinition): string;
    addSchematicNode(definition: SchematicNodeContributionDefinition): string;
    addSettingsPanel(definition: SettingsPanelDefinition): string;
    addPopupUi(definition: PopupUiDefinition): string;
}

/** Public definition consumed by `definePlugin`. @dartwic-reference @category Plugin Registration */
export interface InterfacePluginDefinition {
    id: string;
    name?: string;
    register(registry: InterfacePluginRegistrar): void;
}

/** Normalized contribution entry returned for inspection and host integration. @dartwic-reference @category Plugin Registration */
export interface InterfaceContributionEntry extends NamedContribution {
    [key: string]: unknown;
}

/** Contributions grouped by supported interface extension point. @dartwic-reference @category Plugin Registration */
export interface InterfaceContributions {
    valueFormats: InterfaceContributionEntry[];
    taskUis: InterfaceContributionEntry[];
    moduleUis: InterfaceContributionEntry[];
    resources: InterfaceContributionEntry[];
    schematicNodes: InterfaceContributionEntry[];
    settingsPanels: InterfaceContributionEntry[];
    popupUis: InterfaceContributionEntry[];
}

/** Runtime form of an interface plugin after registration has been evaluated. @dartwic-reference @category Plugin Registration */
export interface MaterializedInterfacePlugin {
    valueFormats: Record<string, ValueFormatDefinition>;
    id: string;
    name: string;
    taskTypes: string[];
    taskCards: Record<string, TaskCardDefinition>;
    taskEditors: Record<string, TaskConfigDefinition>;
    moduleUis: Record<string, ModuleUiDefinition>;
    resources: ResourceDefinition[];
    schematicNodes: SchematicNodeDefinition[];
    settingsPanels: SettingsPanelDefinition[];
    popupUis: Record<string, PopupUiDefinition>;
    contributions: {interface: InterfaceContributions};
}

/** Numeric presentation and editing selected by `format=plugin-id.local-id` in Units.  @dartwic-reference @category Plugin Registration */
export interface ValueFormatDefinition extends NamedContribution {
    format(value: number, options?: {locale?: string; timeZone?: string}): string;
    toDraft?(value: number): string;
    parse?(draft: string): number;
    inputType?: "text" | "number" | "datetime-local";
    placeholder?: string;
    help?: string;
    Editor?: (props: {value: number; onCommit(value: number): Promise<void>; onCancel?(): void; disabled: boolean}) => any;
}

/** Host services and shared component inventory supplied to a loaded interface plugin. @dartwic-reference @category Runtime */
export interface InterfacePluginHostApi {
    /** Optional local notification/issue services. Older hosts may not expose this capability. */
    notifications?: {createClient(source: string): import("../notifications/index.ts").LocalNotificationClient};
    React: Record<string, unknown>;
    useDartwic: (...args: unknown[]) => unknown;
    components: Record<string, unknown>;
    helpers: Record<string, unknown>;
    hooks: Record<string, (...args: any[]) => any>;
    sdk: {
        styling: {
            cn: (...inputs: unknown[]) => string;
        };
        hooks: Record<string, (...args: any[]) => any>;
    };
}
