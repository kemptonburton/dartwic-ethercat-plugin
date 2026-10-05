import {createHostComponent} from "../internal/createHostComponent.ts";
import type {MarkdownChipDefinition, MarkdownRendererProps} from "./types.ts";

/** Shared host Markdown renderer. The host owns React, TipTap, and ProseMirror.  @dartwic-reference @category Markdown */
export const MarkdownRenderer = createHostComponent<MarkdownRendererProps>(
    "MarkdownRenderer",
    (hostApi) => hostApi.components.MarkdownRenderer,
);

/** Defines a plugin-owned Markdown chip without exposing the host editor runtime.  @dartwic-reference @category Markdown */
export function defineMarkdownChip<Token = unknown>(definition: MarkdownChipDefinition<Token>): MarkdownChipDefinition<Token> {
    if (!definition || typeof definition !== "object") {
        throw new Error("defineMarkdownChip(...) requires a definition.");
    }
    if (!String(definition.id ?? "").trim()) {
        throw new Error("A Markdown chip id is required.");
    }
    if (typeof definition.parse !== "function" || typeof definition.serialize !== "function" || typeof definition.component !== "function") {
        throw new Error(`Markdown chip '${definition.id}' requires parse, serialize, and component functions.`);
    }
    return definition;
}

export type {
    MarkdownChannelDropContext,
    MarkdownChipDefinition,
    MarkdownChipParseResult,
    MarkdownChipRenderProps,
    MarkdownDropAction,
    MarkdownLineNumberMode,
    MarkdownMode,
    MarkdownRemoteParticipant,
    MarkdownRendererHandle,
    MarkdownRendererProps,
    MarkdownSelection,
} from "./types.ts";
