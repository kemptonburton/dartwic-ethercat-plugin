import type {HostEventHandler, HostNode} from "../ui/types.ts";

/** Select read-only viewing or Markdown editing. @dartwic-reference @category Markdown */
export type MarkdownMode = "view" | "edit";
/** Choose line numbers for all lines, checkboxes, or no lines. @dartwic-reference @category Markdown */
export type MarkdownLineNumberMode = "all" | "checkbox" | "off";

/** Document selection offsets used for editing and participant presence. @dartwic-reference @category Markdown */
export interface MarkdownSelection {
    from: number;
    to: number;
    anchor?: number;
    head?: number;
}

/** Imperative access to Markdown content, remote edits, heading navigation, focus, and presence. @dartwic-reference @category Markdown */
export interface MarkdownRendererHandle {
    getMarkdown(): string;
    setMarkdown(markdown: string): void;
    applyRemoteEdits(changeBatches?: unknown[], fallbackMarkdown?: string | null): boolean;
    focusHeading(idOrPosition: string | number): void;
    getPresenceSnapshot(): MarkdownSelection | null;
    hasFocus(): boolean;
}

/** Parsed chip token and selection/edit callbacks supplied to its component. @dartwic-reference @category Markdown */
export interface MarkdownChipRenderProps<Token = unknown> {
    token: Token;
    tokenId: string;
    canEdit: boolean;
    mode: MarkdownMode;
    commandEnabled: boolean;
    selected: boolean;
    select(): void;
    clearSelection(): void;
    updateToken(nextToken: Token): void;
}

/** Matched source text and typed token returned by a chip parser. @dartwic-reference @category Markdown */
export interface MarkdownChipParseResult<Token = unknown> {
    raw: string;
    token: Token;
}

/** Parser, serializer, and render component for a plugin-owned Markdown chip. @dartwic-reference @category Markdown */
export interface MarkdownChipDefinition<Token = unknown> {
    id: string;
    prefix?: string;
    start?(source: string): number;
    parse(source: string): MarkdownChipParseResult<Token> | null | undefined;
    serialize(token: Token): string;
    component: (props: MarkdownChipRenderProps<Token>) => HostNode;
}

/** Labeled action offered when a channel is dropped into Markdown. @dartwic-reference @category Markdown */
export interface MarkdownDropAction {
    id: string;
    label: string;
    icon?: HostNode;
    onSelect(): void;
}

/** Dropped channel, pointer position, and callback for inserting Markdown. @dartwic-reference @category Markdown */
export interface MarkdownChannelDropContext {
    channelName: string;
    clientPosition?: {x: number; y: number};
    insertMarkdown(markdown: string): void;
    [name: string]: unknown;
}

/** Remote participant identity, appearance, selection, and cursor presence. @dartwic-reference @category Markdown */
export interface MarkdownRemoteParticipant {
    clientId?: string;
    username?: string;
    displayName?: string;
    accentColor?: string;
    avatarImageSrc?: string;
    avatarFallbackText?: string;
    selection?: MarkdownSelection | null;
    cursorPosition?: {x: number; y: number} | null;
    presenceMode?: MarkdownMode;
}

/** Content, editing controls, chips, collaboration, and callbacks for the host Markdown renderer. @dartwic-reference @category Markdown */
export interface MarkdownRendererProps {
    [name: string]: unknown;
    value: string;
    mode?: MarkdownMode;
    editable?: boolean;
    lightweight?: boolean;
    chips?: MarkdownChipDefinition[];
    getChannelDropActions?: (context: MarkdownChannelDropContext) => MarkdownDropAction[];
    editorRef?: {current: MarkdownRendererHandle | null};
    defaultOrigin?: string;
    commandEnabled?: boolean;
    lineNumberMode?: MarkdownLineNumberMode;
    showToolbar?: boolean;
    showToc?: boolean;
    showGutter?: boolean;
    tocOpen?: boolean;
    closeTocOnHeadingClick?: boolean;
    onTocOpenChange?: (open: boolean) => void;
    onModeChange?: (mode: MarkdownMode) => void;
    onCommandEnabledChange?: (enabled: boolean) => void;
    onLineNumberModeChange?: (mode: MarkdownLineNumberMode) => void;
    onMarkdownChange?: (markdown: string) => void;
    onTransactionBatch?: HostEventHandler;
    onPresenceChange?: (selection: MarkdownSelection) => void;
    onViewCursorPresenceChange?: (position: {x: number; y: number} | null) => void;
    onUndoRedoStateChange?: HostEventHandler;
    onFocusChange?: (focused: boolean) => void;
    onSelectedTokenChange?: (tokenId: string | null) => void;
    remoteParticipants?: Record<string, MarkdownRemoteParticipant>;
    className?: string;
    titleText?: string;
}
