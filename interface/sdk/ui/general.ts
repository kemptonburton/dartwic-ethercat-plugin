import { createHostComponent } from "../internal/createHostComponent.ts";
/** Reusable numeric editor driven by the channel's Units formatting directive.  @dartwic-reference @category UI Components */
export const FormattedValueInput = createHostComponent<{
    value: number; units?: string; label?: string; submitLabel?: string; disabled?: boolean;
    onCommit(value: number): unknown; onCancel?(): void;
}>("FormattedValueInput", (hostApi) => hostApi.components.FormattedValueInput);
/** Popover with formatted display and the registered value editor.  @dartwic-reference @category UI Components */
export const FormattedValueControl = createHostComponent<{
    value: number; units?: string; label?: string; submitLabel?: string; disabled?: boolean;
    onCommit(value: number): unknown; children?: any; className?: string;
    variant?: "default" | "outline" | "ghost" | "link" | "secondary" | "destructive";
}>("FormattedValueControl", (hostApi) => hostApi.components.FormattedValueControl);
import type {
    ButtonProps,
    CardContentProps,
    CardDescriptionProps,
    CardHeaderProps,
    CardProps,
    CardTitleProps,
    CheckboxProps,
    DialogDescriptionProps,
    DialogFooterProps,
    DialogHeaderProps,
    DialogTitleProps,
    HostComponentProps,
    InputProps,
    LabelProps,
    ScrollAreaProps,
    ScrollBarProps,
    SelectContentProps,
    SelectItemProps,
    SelectProps,
    SelectTriggerProps,
    SelectValueProps,
    SeparatorProps,
    SwitchProps,
    TabsContentProps,
    TabsListProps,
    TabsProps,
    TabsTriggerProps,
    TooltipContentProps,
    TooltipProps,
    TooltipTriggerProps,
} from "./types.ts";

/** Standard host button. @dartwic-reference @category UI Components */
export const Button = createHostComponent<ButtonProps>("Button", (hostApi) => hostApi.components.Button);
/** Card layout container. @dartwic-reference @category UI Components */
export const Card = createHostComponent<CardProps>("Card", (hostApi) => hostApi.components.Card);
/** Card body container. @dartwic-reference @category UI Components */
export const CardContent = createHostComponent<CardContentProps>("CardContent", (hostApi) => hostApi.components.CardContent);
/** Secondary card description text. @dartwic-reference @category UI Components */
export const CardDescription = createHostComponent<CardDescriptionProps>("CardDescription", (hostApi) => hostApi.components.CardDescription);
/** Card heading container. @dartwic-reference @category UI Components */
export const CardHeader = createHostComponent<CardHeaderProps>("CardHeader", (hostApi) => hostApi.components.CardHeader);
/** Card title text. @dartwic-reference @category UI Components */
export const CardTitle = createHostComponent<CardTitleProps>("CardTitle", (hostApi) => hostApi.components.CardTitle);
/** Boolean or indeterminate checkbox. @dartwic-reference @category UI Components */
export const Checkbox = createHostComponent<CheckboxProps>("Checkbox", (hostApi) => hostApi.components.Checkbox);
/** Root component for a context menu. @dartwic-reference @category UI Components */
export const ContextMenu = createHostComponent<HostComponentProps>("ContextMenu", (hostApi) => hostApi.components.ContextMenu);
/** Container for context menu actions. @dartwic-reference @category UI Components */
export const ContextMenuContent = createHostComponent<HostComponentProps>("ContextMenuContent", (hostApi) => hostApi.components.ContextMenuContent);
/** Selectable context menu action. @dartwic-reference @category UI Components */
export const ContextMenuItem = createHostComponent<HostComponentProps>("ContextMenuItem", (hostApi) => hostApi.components.ContextMenuItem);
/** Visual separator between context menu groups. @dartwic-reference @category UI Components */
export const ContextMenuSeparator = createHostComponent<HostComponentProps>("ContextMenuSeparator", (hostApi) => hostApi.components.ContextMenuSeparator);
/** Element whose context action opens the menu. @dartwic-reference @category UI Components */
export const ContextMenuTrigger = createHostComponent<HostComponentProps>("ContextMenuTrigger", (hostApi) => hostApi.components.ContextMenuTrigger);
/** Accessible dialog description. @dartwic-reference @category UI Components */
export const DialogDescription = createHostComponent<DialogDescriptionProps>("DialogDescription", (hostApi) => hostApi.components.DialogDescription);
/** Dialog action footer. @dartwic-reference @category UI Components */
export const DialogFooter = createHostComponent<DialogFooterProps>("DialogFooter", (hostApi) => hostApi.components.DialogFooter);
/** Dialog heading layout. @dartwic-reference @category UI Components */
export const DialogHeader = createHostComponent<DialogHeaderProps>("DialogHeader", (hostApi) => hostApi.components.DialogHeader);
/** Accessible dialog title. @dartwic-reference @category UI Components */
export const DialogTitle = createHostComponent<DialogTitleProps>("DialogTitle", (hostApi) => hostApi.components.DialogTitle);
/** Standard text or native typed input. @dartwic-reference @category UI Components */
export const Input = createHostComponent<InputProps>("Input", (hostApi) => hostApi.components.Input);
/** Form label. @dartwic-reference @category UI Components */
export const Label = createHostComponent<LabelProps>("Label", (hostApi) => hostApi.components.Label);
/** Styled scroll viewport. @dartwic-reference @category UI Components */
export const ScrollArea = createHostComponent<ScrollAreaProps>("ScrollArea", (hostApi) => hostApi.components.ScrollArea);
/** Scroll-area bar. @dartwic-reference @category UI Components */
export const ScrollBar = createHostComponent<ScrollBarProps>("ScrollBar", (hostApi) => hostApi.components.ScrollBar);
/** Select-value controller. @dartwic-reference @category UI Components */
export const Select = createHostComponent<SelectProps>("Select", (hostApi) => hostApi.components.Select);
/** Select popup content. @dartwic-reference @category UI Components */
export const SelectContent = createHostComponent<SelectContentProps>("SelectContent", (hostApi) => hostApi.components.SelectContent);
/** Selectable value item. @dartwic-reference @category UI Components */
export const SelectItem = createHostComponent<SelectItemProps>("SelectItem", (hostApi) => hostApi.components.SelectItem);
/** Control that opens select content. @dartwic-reference @category UI Components */
export const SelectTrigger = createHostComponent<SelectTriggerProps>("SelectTrigger", (hostApi) => hostApi.components.SelectTrigger);
/** Selected value display. @dartwic-reference @category UI Components */
export const SelectValue = createHostComponent<SelectValueProps>("SelectValue", (hostApi) => hostApi.components.SelectValue);
/** Horizontal or vertical visual separator. @dartwic-reference @category UI Components */
export const Separator = createHostComponent<SeparatorProps>("Separator", (hostApi) => hostApi.components.Separator);
/** Boolean switch control. @dartwic-reference @category UI Components */
export const Switch = createHostComponent<SwitchProps>("Switch", (hostApi) => hostApi.components.Switch);
/** Tab selection controller. @dartwic-reference @category UI Components */
export const Tabs = createHostComponent<TabsProps>("Tabs", (hostApi) => hostApi.components.Tabs);
/** Content associated with one tab value. @dartwic-reference @category UI Components */
export const TabsContent = createHostComponent<TabsContentProps>("TabsContent", (hostApi) => hostApi.components.TabsContent);
/** Layout container for tab triggers. @dartwic-reference @category UI Components */
export const TabsList = createHostComponent<TabsListProps>("TabsList", (hostApi) => hostApi.components.TabsList);
/** Control that activates one tab value. @dartwic-reference @category UI Components */
export const TabsTrigger = createHostComponent<TabsTriggerProps>("TabsTrigger", (hostApi) => hostApi.components.TabsTrigger);
/** Tooltip state controller. @dartwic-reference @category UI Components */
export const Tooltip = createHostComponent<TooltipProps>("Tooltip", (hostApi) => hostApi.components.Tooltip);
/** Tooltip popup content. @dartwic-reference @category UI Components */
export const TooltipContent = createHostComponent<TooltipContentProps>("TooltipContent", (hostApi) => hostApi.components.TooltipContent);
/** Element that opens a tooltip. @dartwic-reference @category UI Components */
export const TooltipTrigger = createHostComponent<TooltipTriggerProps>("TooltipTrigger", (hostApi) => hostApi.components.TooltipTrigger);

export type {
    ButtonProps,
    CardContentProps,
    CardDescriptionProps,
    CardHeaderProps,
    CardProps,
    CardTitleProps,
    CheckboxProps,
    DialogDescriptionProps,
    DialogFooterProps,
    DialogHeaderProps,
    DialogTitleProps,
    HostEventHandler,
    HostNode,
    HostComponentProps,
    InputProps,
    LabelProps,
    ScrollAreaProps,
    ScrollBarProps,
    SelectContentProps,
    SelectItemProps,
    SelectProps,
    SelectTriggerProps,
    SelectValueProps,
    SeparatorProps,
    SwitchProps,
    TabsContentProps,
    TabsListProps,
    TabsProps,
    TabsTriggerProps,
    TooltipContentProps,
    TooltipProps,
    TooltipTriggerProps,
} from "./types.ts";
