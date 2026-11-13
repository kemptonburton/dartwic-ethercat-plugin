/** Props passed to the canvas renderer for one schematic node. @dartwic-reference @category Schematic Nodes */
export interface SchematicNodeProps {
    [key: string]: any;
    type?: string;
    width?: number;
    height?: number;
    data?: any;
    selected?: boolean;
    id?: string;
}

/** Props passed to a schematic node configuration component. @dartwic-reference @category Schematic Nodes */
export interface SchematicNodeConfigProps {
    [key: string]: any;
    /** Canvas node records. updateNodes patches node records, not just their data. */
    nodes: SchematicNodeRecord[];
    updateNodes(nodes: SchematicNodeRecord[], patch: Partial<SchematicNodeRecord> | ((node: SchematicNodeRecord) => Partial<SchematicNodeRecord>), options?: Record<string, unknown>): void;
    draft?: boolean;
    data?: any;
    updateNode?: (nextData: any) => void;
    defaults?: any;
}

/** Operator command exposed by a schematic node. @dartwic-reference @category Schematic Nodes */
export interface SchematicCommandAction {
    id: string;
    label: string;
    disabled?: boolean;
    hidden?: boolean;
    description?: string;
    input?: {
        type?: "text" | "number";
        placeholder?: string;
        defaultValue?: unknown;
        min?: string | number;
        max?: string | number;
        step?: string | number;
    };
    choice?: {
        items: Array<{value: string; label: string; keywords?: string[]}>;
        defaultValue?: unknown;
        placeholder?: string;
        searchPlaceholder?: string;
        emptyPlaceholder?: string;
    };
    onRun?: (value?: unknown) => unknown | Promise<unknown>;
}

/** Runtime context supplied while building node command actions. @dartwic-reference @category Schematic Nodes */
export interface SchematicCommandContext {
    data?: any;
    id?: string;
    type?: string;
    channels?: Record<string, any>;
    controlEnabled?: boolean;
    operation?: (operationName: string, payload?: any, timeoutMs?: number) => Promise<any>;
}

/** Palette label and default node data for a schematic contribution. @dartwic-reference @category Schematic Nodes */
export interface SchematicNodePaletteDefinition {
    name?: string;
    /** Built-in category id or a custom category shared by browser, Insert Node and gallery. */
    category?: string;
    defaults?: Record<string, unknown>;
}

/** Complete renderer, editor, palette, sizing, and command contract for a node type. @dartwic-reference @category Schematic Nodes */
export interface SchematicNodeDefinition {
    type: string;
    component: (props: BaseNodeProps) => any;
    configComponent?: (props: SchematicNodeConfigProps) => any;
    getCommandActions?: (context: SchematicCommandContext) => SchematicCommandAction[];
    selectionIcon?: any;
    propDefaults?: Record<string, unknown>;
    dataDefaults?: Record<string, unknown>;
    resizable?: boolean;
    connectable?: boolean;
    useMeasuredSize?: boolean;
    /** Set false to register a renderer without a browser/gallery entry. */
    palette?: SchematicNodePaletteDefinition | false;
    /** True when configComponent already renders BaseNodeConfig or GeneralNodeConfig. */
    configIncludesBase?: boolean;
    /** Opt into Insert Node and existing-node channel drops using shared or custom binding rules. */
    channelBinding?: "general" | "readout" | "control" | SchematicChannelBinding;
}

/** Metadata supplied for channel insertion and existing-node drops. @dartwic-reference @category Schematic Nodes */
export interface SchematicChannelDropContext {
    channelName: string;
    channelReference?: string;
    channelData?: any;
    allChannels?: Record<string, any>;
    pair: {command_channel: string; state_channel: string};
    makeRowId(): string;
}

/** Synchronous data patch only; must not write channel values or perform I/O. @dartwic-reference @category Schematic Nodes */
export interface SchematicChannelBinding {
    paired?: boolean | ((data: SchematicNodeData) => boolean);
    bind(data: SchematicNodeData, context: SchematicChannelDropContext): Partial<SchematicNodeData>;
}

/** Stable normalized connection coordinate and outward edge direction. @dartwic-reference @category Schematic Nodes */
export interface SchematicConnectionPort {
    id: string;
    label?: string;
    x: number;
    y: number;
    side?: "left" | "right" | "top" | "bottom";
}

/** Saved handle behavior. Roles describe activity propagation, not edge direction. @dartwic-reference @category Schematic Nodes */
export type SchematicHandleRole = "none" | "sink" | "source";

/** Saved node data; custom fields are retained by normal editing and persistence. @dartwic-reference @category Schematic Nodes */
export interface SchematicNodeData {
    [key: string]: any;
    preset_name?: string;
    general_settings?: Record<string, any>;
    connection_ports?: SchematicConnectionPort[];
    connection_port_aliases?: Record<string, string>;
    fluid_port_roles?: Record<string, SchematicHandleRole>;
}

/** Serializable node instance or preset, independent of its renderer. @dartwic-reference @category Schematic Nodes */
export interface SchematicNodeRecord {
    [key: string]: any;
    type: string;
    id?: string;
    width?: number;
    height?: number;
    position?: {x: number; y: number};
    data: SchematicNodeData;
}

/** Named data-only browser, Insert Node and gallery contribution. Use type general for shared building blocks. @dartwic-reference @category Schematic Nodes */
export interface SchematicNodePresetDefinition {
    id: string;
    name: string;
    category?: string;
    node: SchematicNodeRecord;
}

/** Shared canvas wrapper: labels, rotation/size, handle roles, inspection and alerts. @dartwic-reference @category Schematic Nodes */
export interface BaseNodeProps extends SchematicNodeProps {
    type: string;
    data: SchematicNodeData;
    children?: any;
    /** Historical spelling retained by the host. */
    resizeable?: boolean;
    useAlerts?: boolean;
    runtimeStatusColor?: string;
    alertTags?: string[];
    contextActions?: Array<{label: string; onSelect: () => void}>;
}

/** Dedicated custom-content tab appended to the shared node editor. @dartwic-reference @category Schematic Nodes */
export interface SchematicNodeConfigSection {
    title: string;
    value: string;
    content: any;
    bare?: boolean;
}

/** Shared Node Setup and Node Appearance editor with optional dedicated tabs. @dartwic-reference @category Schematic Nodes */
export interface BaseNodeConfigProps extends SchematicNodeConfigProps {
    sections?: SchematicNodeConfigSection[];
    artworkOnly?: boolean;
    sharedOnly?: boolean;
}

/** A searchable configuration entry; settingPath enables shared selection editing and mixed values. @dartwic-reference @category Schematic Nodes */
export interface NodeSettingsFieldProps {
    [key: string]: any;
    label: string;
    settingPath?: string;
    settingValue?: (node: SchematicNodeRecord) => unknown;
    relatedPaths?: string[];
    children?: any;
}
