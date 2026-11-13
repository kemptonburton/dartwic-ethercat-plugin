import type { SchematicNodeDefinition } from "./types.ts";
import {createHostComponent} from "../internal/createHostComponent.ts";
import {getHostApi} from "../internal/host.ts";
import type {BaseNodeProps, BaseNodeConfigProps, NodeSettingsFieldProps, SchematicNodeConfigProps, SchematicNodePresetDefinition, SchematicNodeRecord} from './types.ts';

/** Use the host's shared node backend with a custom center. No Engine write occurs during rendering. @dartwic-reference @category Schematic Nodes */
export const BaseNode = createHostComponent<BaseNodeProps>('BaseNode', host => host.components.BaseNode);
/** Render the standard shared editor and dedicated sections. @dartwic-reference @category Schematic Nodes */
export const BaseNodeConfig = createHostComponent<BaseNodeConfigProps>('BaseNodeConfig', host => host.components.BaseNodeConfig);
/** Render the configurable General Node, including readout, command, shape and media building blocks. @dartwic-reference @category Schematic Nodes */
export const GeneralNode = createHostComponent<BaseNodeProps>('GeneralNode', host => host.components.GeneralNode);
/** Edit General Node using the same tabs and mixed-selection behavior as built-ins. @dartwic-reference @category Schematic Nodes */
export const GeneralNodeConfig = createHostComponent<SchematicNodeConfigProps>('GeneralNodeConfig', host => host.components.GeneralNodeConfig);
/** Searchable, mixed-value-aware entry in a node configuration section. @dartwic-reference @category Schematic Nodes */
export const NodeSettingsField = createHostComponent<NodeSettingsFieldProps>('NodeSettingsField', host => host.components.NodeSettingsField);
/** Searchable, mixed-value-aware switch in a node configuration section. @dartwic-reference @category Schematic Nodes */
export const NodeSettingsToggle = createHostComponent<NodeSettingsFieldProps>('NodeSettingsToggle', host => host.components.NodeSettingsToggle);
/** Standard wrapping group of configuration entries. @dartwic-reference @category Schematic Nodes */
export const NodeSettingsSection = createHostComponent<Record<string, any>>('NodeSettingsSection', host => host.components.NodeSettingsSection);
/** Standard collapsible node configuration group. @dartwic-reference @category Schematic Nodes */
export const NodeSettingsDetails = createHostComponent<Record<string, any>>('NodeSettingsDetails', host => host.components.NodeSettingsDetails);
/** Shared configurable-input / If Else source editor. @dartwic-reference @category Schematic Nodes */
export const NodeValueSource = createHostComponent<Record<string, any>>('NodeValueSource', host => host.components.NodeValueSource);
/** Shared glyph/card center layout, including table and authority chrome. @dartwic-reference @category Schematic Nodes */
export const NodeReadoutLayout = createHostComponent<Record<string, any>>('NodeReadoutLayout', host => host.components.NodeReadoutLayout);
/** Shared title, value, units, gauge/bar and sparkline presentation. @dartwic-reference @category Schematic Nodes */
export const ReadoutContent = createHostComponent<Record<string, any>>('ReadoutContent', host => host.components.ReadoutContent);

function helper(name: string, ...args: unknown[]): any {
    const fn = getHostApi().helpers[name];
    if (typeof fn !== 'function') throw new Error(`The interface host does not provide ${name}. Check minInterfaceVersion.`);
    return fn(...args);
}
/** Return fresh General Node defaults. Pure synchronous creation; does not add a canvas node or write files. @dartwic-reference @category Schematic Nodes */
export const createGeneralNodeDefaults = (): SchematicNodeRecord => helper('createGeneralNodeDefaults');
/** Normalize a saved legacy node without changing its identity or attachments. Synchronous, no persistence. @dartwic-reference @category Schematic Nodes */
export const normalizeGeneralNode = (node: SchematicNodeRecord): SchematicNodeRecord => helper('normalizeGeneralNode', node);
/** Apply built-in channel/title/units and command-feedback pairing rules to node data. Synchronous, no channel write. @dartwic-reference @category Schematic Nodes */
export const bindSchematicChannel = (type: string, data: Record<string, any>, context: {channelName: string; channelReference?: string; channelData?: any; allChannels?: Record<string, any>}): Record<string, any> => helper('bindSchematicChannel', type, data, context);
/** Define serializable initial data for registration with addSchematicNodePreset. No filesystem writes. @dartwic-reference @category Schematic Nodes */
export function defineSchematicNodePreset(definition: SchematicNodePresetDefinition): SchematicNodePresetDefinition {
    if (!definition?.node?.type || !definition.node.data || !definition.name?.trim()) throw new Error('A schematic preset requires a name and node with type and data.');
    return definition;
}

/** Defines a schematic node renderer and its editing behavior. @dartwic-reference @category Schematic Nodes */
export function defineSchematicNode(definition: SchematicNodeDefinition): SchematicNodeDefinition {
    return definition;
}

export type {
    BaseNodeProps, BaseNodeConfigProps, NodeSettingsFieldProps, SchematicNodeRecord, SchematicNodeData,
    SchematicChannelBinding, SchematicChannelDropContext,
    SchematicConnectionPort, SchematicHandleRole, SchematicNodeConfigSection, SchematicNodePresetDefinition,
    SchematicCommandAction,
    SchematicCommandContext,
    SchematicNodeConfigProps,
    SchematicNodeDefinition,
    SchematicNodePaletteDefinition,
    SchematicNodeProps
} from "./types.ts";
