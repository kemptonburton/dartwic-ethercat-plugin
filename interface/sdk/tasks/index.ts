import React from "../react.ts";
import type {
    TaskCardDefinition,
    TaskConfigBridgeState,
    TaskConfigDefinition,
    TaskConfigRegistration
} from "./types.ts";

/** Defines a task-card component contract. @dartwic-reference @category Tasks */
export function defineTaskCard(definition: TaskCardDefinition): TaskCardDefinition {
    return definition;
}

/** Defines a task configuration editor contract. @dartwic-reference @category Tasks */
export function defineTaskConfig(definition: TaskConfigDefinition): TaskConfigDefinition {
    return definition;
}

/** Synchronizes save, cancel, dirty, and validation state with the host task editor. @dartwic-reference @category Tasks */
export function useTaskConfigBridge(taskEditor: TaskConfigRegistration | null | undefined, config: TaskConfigBridgeState = {}) {
    const {
        isDirty = false,
        isSaving = false,
        canSave = true,
        errorMessage = "",
        saveLabel = "SAVE",
        cancelLabel = "CANCEL",
        onSave = null,
        onCancel = null,
        moduleConnection = null,
    } = config;

    (React as any).useEffect(() => {
        taskEditor?.register?.({
            isDirty,
            isSaving,
            canSave,
            errorMessage,
            saveLabel,
            cancelLabel,
            onSave,
            onCancel,
            moduleConnection,
        });
    }, [
        taskEditor,
        isDirty,
        isSaving,
        canSave,
        errorMessage,
        saveLabel,
        cancelLabel,
        onSave,
        onCancel,
        moduleConnection,
    ]);
}

export type {
    TaskCardDefinition,
    TaskCardProps,
    TaskConfigBridgeState,
    TaskConfigDefinition,
    TaskConfigProps,
    TaskConfigRegistration,
} from "./types.ts";
