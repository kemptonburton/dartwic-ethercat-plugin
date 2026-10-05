import { createHostComponent } from "../internal/createHostComponent.ts";
import { getHostApi } from "../internal/host.ts";
import type {ChannelComboBoxProps, ComboboxSearchProps, ConfigurableInputProps, ManualRefreshButtonProps, ModuleConnectionStatusProps, ModuleInstanceConnectionProps, ModuleInstanceSelectProps, ModuleRuntimeOverviewProps, TaskBindingTableProps} from "./types.ts";

/** Selects a DARTWIC channel and, optionally, one of its fields. @dartwic-reference @category DARTWIC UI Components */
export const ChannelComboBox = createHostComponent<ChannelComboBoxProps>("ChannelComboBox", (hostApi) => hostApi.helpers.ChannelComboBox);
/** Searches a fixed option list using DARTWIC's standard host-owned combobox. @dartwic-reference @category DARTWIC UI Components */
export const ComboboxSearch = createHostComponent<ComboboxSearchProps>("ComboboxSearch", (hostApi) => hostApi.helpers.ComboboxSearch);
/** Edits a configurable literal, channel reference, or expression value. @dartwic-reference @category DARTWIC UI Components */
export const ConfigurableInput = createHostComponent<ConfigurableInputProps>("ConfigurableInput", (hostApi) => hostApi.helpers.ConfigurableInput);
/** Renders the standard refresh icon button with an in-progress state. @dartwic-reference @category DARTWIC UI Components */
export const ManualRefreshButton = createHostComponent<ManualRefreshButtonProps>("ManualRefreshButton", (hostApi) => hostApi.helpers.ManualRefreshButton);
/** Selects only module instances owned by the requested plugin and compatible module types. @dartwic-reference @category DARTWIC UI Components */
export const ModuleInstanceSelect = createHostComponent<ModuleInstanceSelectProps>("ModuleInstanceSelect", (hostApi) => hostApi.helpers.ModuleInstanceSelect);
/** Renders the standard task-detail module selector, resource link, and live connection state. @dartwic-reference @category DARTWIC UI Components */
export const ModuleInstanceConnection = createHostComponent<ModuleInstanceConnectionProps>("ModuleInstanceConnection", (hostApi) => hostApi.helpers.ModuleInstanceConnection);
/** Renders the shared live connection indicator for an opted-in module.  @dartwic-reference @category DARTWIC UI Components */
export const ModuleConnectionStatus = createHostComponent<ModuleConnectionStatusProps>("ModuleConnectionStatus", (hostApi) => hostApi.helpers.ModuleConnectionStatus);
/** Shows a module's linked tasks, live connection state, and mapped channels using the host's standard presentation.  @dartwic-reference @category DARTWIC UI Components */
export const ModuleRuntimeOverview = createHostComponent<ModuleRuntimeOverviewProps>("ModuleRuntimeOverview", (hostApi) => hostApi.helpers.ModuleRuntimeOverview);
/** Renders the standard editable task channel-binding table. @dartwic-reference @category DARTWIC UI Components */
export const TaskBindingTable = createHostComponent<TaskBindingTableProps>("TaskBindingTable", (hostApi) => hostApi.helpers.TaskBindingTable);
/** Show the participants associated with a resource. @dartwic-reference @category DARTWIC UI Components */
export const ResourceParticipantsIcon = createHostComponent<Record<string, unknown>>("ResourceParticipantsIcon", (hostApi) => hostApi.components.ResourceParticipantsIcon);
/** Show resource synchronization status. @dartwic-reference @category DARTWIC UI Components */
export const ResourceSyncStatusIcon = createHostComponent<Record<string, unknown>>("ResourceSyncStatusIcon", (hostApi) => hostApi.components.ResourceSyncStatusIcon);
/** Embed a remote engine view using the host component. @dartwic-reference @category DARTWIC UI Components */
export const EmbeddedRemoteView = createHostComponent<Record<string, unknown>>("EmbeddedRemoteView", (hostApi) => hostApi.components.EmbeddedRemoteView);
/** Embed a schematic node using the host component. @dartwic-reference @category DARTWIC UI Components */
export const EmbeddedSchematicNode = createHostComponent<Record<string, unknown>>("EmbeddedSchematicNode", (hostApi) => hostApi.components.EmbeddedSchematicNode);
/** Display an alert in the host console presentation. @dartwic-reference @category DARTWIC UI Components */
export const ConsoleAlert = createHostComponent<Record<string, unknown>>("ConsoleAlert", (hostApi) => hostApi.components.ConsoleAlert);
/** Display details about stale channel data. @dartwic-reference @category DARTWIC UI Components */
export const StaleChannelsTooltip = createHostComponent<Record<string, unknown>>("StaleChannelsTooltip", (hostApi) => hostApi.components.StaleChannelsTooltip);
/** Edit conditional branch configuration with the host component. @dartwic-reference @category DARTWIC UI Components */
export const IfElseBlock = createHostComponent<Record<string, unknown>>("IfElseBlock", (hostApi) => hostApi.components.IfElseBlock);
/** Configure an abstracted schematic button node. @dartwic-reference @category DARTWIC UI Components */
export const AbstractedButtonNodeConfig = createHostComponent<Record<string, unknown>>("AbstractedButtonNodeConfig", (hostApi) => hostApi.components.AbstractedButtonNodeConfig);

/**
 * Converts a value reference such as `|channel|` into its channel name.
 *
 * @dartwic-reference
 * @category DARTWIC UI Components
 * @param value Channel reference to normalize.
 * @returns The channel name contained in the reference.
 */
export function convertChannelReferenceToChannelName(value: string) {
    const convert = getHostApi().helpers.convertChannelReferenceToChannelName;
    if (typeof convert !== "function") {
        throw new Error("The interface host does not provide convertChannelReferenceToChannelName.");
    }
    return String(convert(value));
}

/** Return the host accent color assigned to a client identity. @dartwic-reference @category DARTWIC UI Components */
export function getParticipantAccentColor(clientId: string) {
    const helper = getHostApi().helpers.getParticipantAccentColor;
    if (typeof helper !== "function") {
        throw new Error("The interface host does not provide getParticipantAccentColor.");
    }
    return String(helper(clientId));
}

function callHelper(name: string, args: unknown[]) {
    const helper = getHostApi().helpers[name];
    if (typeof helper !== "function") throw new Error(`The interface host does not provide ${name}.`);
    return helper(...args);
}

/** Build a channel-field payload from a value reference and optional field. @dartwic-reference @category DARTWIC UI Components */
export const buildChannelFieldPayload = (value: string, field?: string | null) => callHelper("buildChannelFieldPayload", [value, field]);
/** Resolve a value reference against a channel-data map. @dartwic-reference @category DARTWIC UI Components */
export const getChannelValueFromChannels = (channels: Record<string, unknown>, value: string) => callHelper("getChannelValueFromChannels", [channels, value]);
/** Evaluate conditional block data against supplied channel values. @dartwic-reference @category DARTWIC UI Components */
export const ifElseBlockCheck = (data: Record<string, unknown>, channels: Record<string, unknown>) => callHelper("ifElseBlockCheck", [data, channels]);
/** Create a control-display schematic node definition from channel data. @dartwic-reference @category DARTWIC UI Components */
export const buildControlDisplayNodeDefinitionFromChannel = (channel: unknown, options?: Record<string, unknown>) => callHelper("buildControlDisplayNodeDefinitionFromChannel", [channel, options]);
/** Create a parameter-display schematic node definition from channel data. @dartwic-reference @category DARTWIC UI Components */
export const buildParameterDisplayNodeDefinitionFromChannel = (channel: unknown, options?: Record<string, unknown>) => callHelper("buildParameterDisplayNodeDefinitionFromChannel", [channel, options]);
/** Normalize a legacy channel and field reference using host rules. @dartwic-reference @category DARTWIC UI Components */
export const normalizeLegacyChannelFieldReference = (value: string, field?: string | null) => callHelper("normalizeLegacyChannelFieldReference", [value, field]);

export type {ChannelComboBoxProps, ComboboxSearchItem, ComboboxSearchProps, ConfigurableInputProps, ManualRefreshButtonProps, ModuleConnectionStatusProps, ModuleInstanceConnectionProps, ModuleInstanceSelectProps, ModuleRuntimeChannel, ModuleRuntimeOverviewProps, TaskBinding, TaskBindingTableProps} from "./types.ts";
