import type { ResourceDefinition } from "./types.ts";

/** Defines a component-backed or directory-backed interface resource. @dartwic-reference @category Resources */
export function defineResource(definition: ResourceDefinition): ResourceDefinition {
    return definition;
}

export type {
    ResourceComponentProps,
    ResourceDefinition,
    ResourceErrorState,
    ResourceType,
    SaveResourceContentOptions,
} from "./types.ts";
