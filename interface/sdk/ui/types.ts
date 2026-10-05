/** Renderable content passed through to the host React runtime. @dartwic-reference @category UI Components */
export type HostNode = unknown;

/** Generic event callback accepted by host-wrapped native controls. @dartwic-reference @category UI Components */
export type HostEventHandler = (...args: any[]) => void;

/**
 * Shared presentation and native pass-through props accepted by host components.
 *
 * @dartwic-reference
 * @category UI Components
 */
export interface HostComponentProps {
    /** Additional Tailwind or host CSS classes. */
    className?: string;
    /** Child content rendered by the host component. */
    children?: HostNode;
    /** Optional DOM identifier. */
    id?: string;
    /** Inline style values passed to the host component. */
    style?: Record<string, unknown>;
    [name: string]: unknown;
}

/** Props accepted by the standard host button. @dartwic-reference @category UI Components */
export interface ButtonProps extends HostComponentProps {
    /** Visual style preset. */
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    /** Size preset. */
    size?: "default" | "sm" | "lg" | "icon";
    /** Render through the host's slot component. */
    asChild?: boolean;
    /** Click event handler. */
    onClick?: HostEventHandler;
    /** Disables interaction. */
    disabled?: boolean;
    /** Native button type. */
    type?: "button" | "submit" | "reset" | string;
}

/** Props accepted by the standard host input. @dartwic-reference @category UI Components */
export interface InputProps extends HostComponentProps {
    /** Controlled input value. */
    value?: string | number;
    /** Initial uncontrolled value. */
    defaultValue?: string | number;
    /** Change event handler. */
    onChange?: HostEventHandler;
    /** Placeholder text shown while empty. */
    placeholder?: string;
    /** Native input type. */
    type?: string;
    /** Disables interaction. */
    disabled?: boolean;
}

/** Props accepted by the host checkbox. @dartwic-reference @category UI Components */
export interface CheckboxProps extends HostComponentProps {
    /** Controlled checked state. */
    checked?: boolean | "indeterminate";
    /** Initial uncontrolled checked state. */
    defaultChecked?: boolean;
    /** Called when the checked state changes. */
    onCheckedChange?: (checked: boolean | "indeterminate") => void;
    /** Disables interaction. */
    disabled?: boolean;
}

/** Props accepted by the select root. @dartwic-reference @category UI Components */
export interface SelectProps extends HostComponentProps {
    /** Controlled selected value. */
    value?: string;
    /** Initial uncontrolled selected value. */
    defaultValue?: string;
    /** Called with the newly selected value. */
    onValueChange?: (value: string) => void;
    /** Disables selection. */
    disabled?: boolean;
}

/** Props accepted by the select trigger. @dartwic-reference @category UI Components */
export interface SelectTriggerProps extends HostComponentProps {}

/** Props accepted by select popup content. @dartwic-reference @category UI Components */
export interface SelectContentProps extends HostComponentProps {
    /** Popup positioning strategy. */
    position?: "popper" | "item-aligned" | string;
}

/** Props accepted by a selectable item. @dartwic-reference @category UI Components */
export interface SelectItemProps extends HostComponentProps {
    /** Value produced when this item is selected. */
    value: string;
    /** Disables this item. */
    disabled?: boolean;
}

/** Props accepted by the selected-value display. @dartwic-reference @category UI Components */
export interface SelectValueProps extends HostComponentProps {
    /** Content shown while no value is selected. */
    placeholder?: HostNode;
}

/** Props accepted by the tabs root. @dartwic-reference @category UI Components */
export interface TabsProps extends HostComponentProps {
    /** Controlled active tab value. */
    value?: string;
    /** Initial uncontrolled tab value. */
    defaultValue?: string;
    /** Called when the active tab changes. */
    onValueChange?: (value: string) => void;
}

/** Props accepted by the tab-list container. @dartwic-reference @category UI Components */
export interface TabsListProps extends HostComponentProps {}

/** Props accepted by a tab trigger. @dartwic-reference @category UI Components */
export interface TabsTriggerProps extends HostComponentProps {
    /** Tab value activated by the trigger. */
    value: string;
    /** Disables the trigger. */
    disabled?: boolean;
}

/** Props accepted by a tab content panel. @dartwic-reference @category UI Components */
export interface TabsContentProps extends HostComponentProps {
    /** Tab value that displays this panel. */
    value: string;
}

/** Props accepted by the host switch. @dartwic-reference @category UI Components */
export interface SwitchProps extends HostComponentProps {
    /** Controlled checked state. */
    checked?: boolean;
    /** Initial uncontrolled checked state. */
    defaultChecked?: boolean;
    /** Called when the checked state changes. */
    onCheckedChange?: (checked: boolean) => void;
    /** Disables interaction. */
    disabled?: boolean;
}

/** Props accepted by the card root. @dartwic-reference @category UI Components */
export interface CardProps extends HostComponentProps {}
/** Props accepted by a card header. @dartwic-reference @category UI Components */
export interface CardHeaderProps extends HostComponentProps {}
/** Props accepted by a card title. @dartwic-reference @category UI Components */
export interface CardTitleProps extends HostComponentProps {}
/** Props accepted by a card description. @dartwic-reference @category UI Components */
export interface CardDescriptionProps extends HostComponentProps {}
/** Props accepted by card content. @dartwic-reference @category UI Components */
export interface CardContentProps extends HostComponentProps {}
/** Props accepted by a form label. @dartwic-reference @category UI Components */
export interface LabelProps extends HostComponentProps {
    /** Identifier of the labeled form control. */
    htmlFor?: string;
}
/** Props accepted by a visual separator. @dartwic-reference @category UI Components */
export interface SeparatorProps extends HostComponentProps {
    /** Separator direction. */
    orientation?: "horizontal" | "vertical";
    /** Whether the separator is purely decorative. */
    decorative?: boolean;
}
/** Props accepted by a scroll viewport. @dartwic-reference @category UI Components */
export interface ScrollAreaProps extends HostComponentProps {}
/** Props accepted by a scroll bar. @dartwic-reference @category UI Components */
export interface ScrollBarProps extends HostComponentProps {
    /** Scroll-bar direction. */
    orientation?: "horizontal" | "vertical";
}
/** Props accepted by the tooltip root. @dartwic-reference @category UI Components */
export interface TooltipProps extends HostComponentProps {
    /** Delay before opening, in milliseconds. */
    delayDuration?: number;
}
/** Props accepted by a tooltip trigger. @dartwic-reference @category UI Components */
export interface TooltipTriggerProps extends HostComponentProps {
    /** Render through the host's slot component. */
    asChild?: boolean;
}
/** Props accepted by tooltip popup content. @dartwic-reference @category UI Components */
export interface TooltipContentProps extends HostComponentProps {
    /** Preferred side of the trigger. */
    side?: "top" | "right" | "bottom" | "left";
    /** Distance from the trigger in pixels. */
    sideOffset?: number;
}
/** Props accepted by a dialog header. @dartwic-reference @category UI Components */
export interface DialogHeaderProps extends HostComponentProps {}
/** Props accepted by a dialog title. @dartwic-reference @category UI Components */
export interface DialogTitleProps extends HostComponentProps {}
/** Props accepted by a dialog description. @dartwic-reference @category UI Components */
export interface DialogDescriptionProps extends HostComponentProps {}
/** Props accepted by a dialog footer. @dartwic-reference @category UI Components */
export interface DialogFooterProps extends HostComponentProps {}

/**
 * Props for the host channel and field selector.
 *
 * @dartwic-reference
 * @category DARTWIC UI Components
 */
export interface ChannelComboBoxProps extends HostComponentProps {
    /** Initial `|channel|` or `|channel|:field` selection. */
    initialValue?: string;
    /** Controlled selection override. */
    overrideValue?: string;
    /** Called with the selected channel value path. */
    onSelect?: (channelValuePath: string) => void;
    /** Limits fields to readable or writable channel fields. */
    mode?: "read" | "write";
    /** Shows the field selector beside the channel selector. */
    showFieldSelector?: boolean;
    /** Empty-selection placeholder. */
    placeholder?: string;
    /** Classes applied to the channel selector. */
    channelComboboxClassName?: string;
    /** Classes applied to the field selector. */
    fieldComboboxClassName?: string;
}

/**
 * Props for editing a serialized configurable-input expression.
 *
 * @dartwic-reference
 * @category DARTWIC UI Components
 */
export interface ConfigurableInputProps extends HostComponentProps {
    /** Serialized configurable-input state. */
    initialData: Record<string, unknown>;
    /** Called whenever the serialized state changes. */
    onDataChange: (nextData: Record<string, unknown>) => void;
    /** Input kinds hidden from the editor. */
    excludedTypes?: string[];
    /** Uses the compact editor layout. */
    compact?: boolean;
}

/**
 * Props for the standard refresh icon button.
 *
 * @dartwic-reference
 * @category DARTWIC UI Components
 */
export interface ManualRefreshButtonProps extends ButtonProps {
    /** Tooltip and accessible label. */
    tooltip?: string;
    /** Shows the spinning refresh state and disables the button. */
    isRefreshing?: boolean;
}

/** Props for selecting a live module instance compatible with a plugin task.  @dartwic-reference @category DARTWIC UI Components */
export interface ModuleInstanceSelectProps extends HostComponentProps {
    /** Engine plugin that must own every displayed module instance. */
    pluginId: string;
    /** Optional compatible module type IDs, in local or plugin-qualified form. */
    moduleTypeIds?: string[];
    /** Selected module-instance name. */
    value?: string;
    /** Called with the selected module-instance name. */
    onValueChange?: (value: string) => void;
    /** Empty-selection prompt. */
    placeholder?: string;
    /** Disables the selector. */
    disabled?: boolean;
    /** Shows loading, incompatibility, and empty-state diagnostics. */
    showStatus?: boolean;
}

/** One searchable option displayed by the host-owned combobox. @dartwic-reference @category DARTWIC UI Components */
export interface ComboboxSearchItem {
    value: string;
    label: HostNode;
}

/** Props for the standard host-owned searchable list selector. @dartwic-reference @category DARTWIC UI Components */
export interface ComboboxSearchProps extends HostComponentProps {
    items: ComboboxSearchItem[];
    initialValue?: string;
    placeholder?: string;
    commandSearchPlaceholder?: string;
    commandSearchEmptyPlaceholder?: string;
    overrideValue?: HostNode;
    onSelect?: (value: string) => void;
    unSelectable?: boolean;
    popoverContentClassName?: string;
}

/** Shared module selector, module link, and opt-in live connection status. @dartwic-reference @category DARTWIC UI Components */
export interface ModuleInstanceConnectionProps extends ModuleInstanceSelectProps {
    /** Supporting copy shown beneath the shared control. */
    description?: string;
    /** Hides the selector and presents only the linked module. */
    showSelector?: boolean;
    /** Shows the module's plugin-declared connection state when available. */
    showConnectionStatus?: boolean;
    /** Shows connection-state text instead of a compact indicator. */
    statusText?: boolean;
    /** Uses the compact header/footer layout. */
    compact?: boolean;
}

/** One editable row in the standard task channel-binding table. @dartwic-reference @category DARTWIC UI Components */
export interface TaskBinding {
    id?: string;
    [name: string]: unknown;
}

/** Standard task binding table shared by plugin task editors. @dartwic-reference @category DARTWIC UI Components */
export interface TaskBindingTableProps extends HostComponentProps {
    title?: string;
    bindings: TaskBinding[];
    onBindingsChange: (bindings: TaskBinding[]) => void;
    bindingTypes: Array<{value: string; label: string}>;
    channelMode?: "read" | "write";
    typeKey?: string;
    addressKey?: string;
    channelKey?: string;
    typeLabel?: string;
    addressLabel?: string;
    channelLabel?: string;
    channelPlaceholder?: string;
    emptyMessage?: string;
    addLabel?: string;
    addDisabled?: boolean;
    normalizeChannelValue?: (value: string) => string;
    createBinding?: (sequence: number) => TaskBinding;
    /** Optional plugin-defined columns rendered with the standard host table styling. */
    columns?: Array<{
        key?: string;
        label: HostNode;
        width?: string;
        render: (binding: TaskBinding, index: number, updateBinding: (binding: TaskBinding) => void) => HostNode;
    }>;
    /** Optional controls replacing the standard single add button. */
    headerActions?: HostNode;
    /** Minimum width of the horizontally scrollable table content. */
    minTableWidth?: string;
}

/** One live channel rendered beneath a linked module task.  @dartwic-reference @category DARTWIC UI Components */
export interface ModuleRuntimeChannel {
    /** RAPID channel name used for live telemetry. */
    name: string;
    /** Optional shorter visible label; the channel name is used by default. */
    label?: string;
    /** Direction relative to the device. */
    direction?: "input" | "output" | "diagnostic";
    /** Optional register, address, or mapping detail. */
    detail?: string;
}

/** Props for the shared opt-in module connection indicator.  @dartwic-reference @category DARTWIC UI Components */
export interface ModuleConnectionStatusProps extends HostComponentProps {
    presentation: {
        channel: string;
        label?: string;
        endpoint?: string;
        connectedValue?: string | number | boolean;
    };
    showText?: boolean;
    compact?: boolean;
}

/** Props for the standard linked-task, status, and channel overview on module pages.  @dartwic-reference @category DARTWIC UI Components */
export interface ModuleRuntimeOverviewProps extends HostComponentProps {
    /** Module instance whose linked tasks are displayed. */
    instanceName: string;
    /** Optional live boolean channel used for connection state. */
    connectionChannel?: string;
    /** Visible label beside the connection state. */
    connectionLabel?: string;
    /** Human-readable connection endpoint. */
    endpoint?: string;
    /** Optional task-type allowlist. */
    taskTypeIds?: string[];
    /** Maps a linked task's plugin arguments to visible live channels. */
    resolveTaskChannels?: (task: any) => ModuleRuntimeChannel[];
    /** Empty-state copy when no tasks reference the module. */
    emptyMessage?: string;
}
