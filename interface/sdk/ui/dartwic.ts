import { createHostComponent } from "../internal/createHostComponent.ts";
import { getHostApi } from "../internal/host.ts";
import type {ChannelComboBoxProps, ComboboxSearchProps, ConfigurableInputProps, ManualRefreshButtonProps, ModuleConnectionStatusProps, ModuleInstanceConnectionProps, ModuleInstanceSelectProps, ModuleRuntimeOverviewProps, TaskBindingTableProps} from "./types.ts";

/** Selects a DARTWIC channel and, optionally, one of its fields. @dartwic-reference @category DARTWIC UI Components */
export const ChannelComboBox = createHostComponent<ChannelComboBoxProps>("ChannelComboBox", (hostApi) => hostApi.helpers.ChannelComboBox);
/** Searches a fixed option list using DARTWIC's shadcn combobox. @dartwic-reference @category DARTWIC UI Components */
export const ComboboxSearch = createHostComponent<ComboboxSearchProps>("ComboboxSearch", (hostApi) => hostApi.helpers.ComboboxSearch);
/** Edits a configurable literal, channel reference, or expression value. @dartwic-reference @category DARTWIC UI Components */
export const ConfigurableInput = createHostComponent<ConfigurableInputProps>("ConfigurableInput", (hostApi) => hostApi.helpers.ConfigurableInput);
/** Renders the standard refresh icon button with an in-progress state. @dartwic-reference @category DARTWIC UI Components */
export const ManualRefreshButton = createHostComponent<ManualRefreshButtonProps>("ManualRefreshButton", (hostApi) => hostApi.helpers.ManualRefreshButton);
/** Selects only module instances owned by the requested plugin and compatible module types. @dartwic-reference @category DARTWIC UI Components */
export const ModuleInstanceSelect = createHostComponent<ModuleInstanceSelectProps>("ModuleInstanceSelect", (hostApi) => hostApi.helpers.ModuleInstanceSelect);
/** Renders the standard task-detail module selector, resource link, and live connection state. @dartwic-reference @category DARTWIC UI Components */
export const ModuleInstanceConnection = createHostComponent<ModuleInstanceConnectionProps>("ModuleInstanceConnection", (hostApi) => hostApi.helpers.ModuleInstanceConnection);
/** Renders the shared live connection indicator for an opted-in module. @dartwic-reference @category DARTWIC UI Components */
export const ModuleConnectionStatus = createHostComponent<ModuleConnectionStatusProps>("ModuleConnectionStatus", (hostApi) => hostApi.helpers.ModuleConnectionStatus);
/** Shows linked tasks, live connection state, and mapped channels using the host's standard presentation. @dartwic-reference @category DARTWIC UI Components */
export const ModuleRuntimeOverview = createHostComponent<ModuleRuntimeOverviewProps>("ModuleRuntimeOverview", (hostApi) => hostApi.helpers.ModuleRuntimeOverview);
/** Renders the standard editable task channel-binding table. @dartwic-reference @category DARTWIC UI Components */
export const TaskBindingTable = createHostComponent<TaskBindingTableProps>("TaskBindingTable", (hostApi) => hostApi.helpers.TaskBindingTable);

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

export type {ChannelComboBoxProps, ComboboxSearchProps, ConfigurableInputProps, ManualRefreshButtonProps, ModuleConnectionStatusProps, ModuleInstanceConnectionProps, ModuleInstanceSelectProps, ModuleRuntimeChannel, ModuleRuntimeOverviewProps, TaskBinding, TaskBindingTableProps} from "./types.ts";
