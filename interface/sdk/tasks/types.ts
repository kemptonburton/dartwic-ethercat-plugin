/** Component signature used by task cards and configuration editors. @dartwic-reference @category Tasks */
export type TaskComponent = (props: any) => any;

/** Props passed to a task card. @dartwic-reference @category Tasks */
export interface TaskCardProps {
    task: any;
    openSource?: (...args: any[]) => void;
}

/** Task type and component registered as a task card. @dartwic-reference @category Tasks */
export interface TaskCardDefinition {
    taskType: string;
    component: TaskComponent;
}

/** Bridge exposed by the host task editor to a plugin configuration component. @dartwic-reference @category Tasks */
export interface TaskConfigRegistration {
    register(nextState?: Record<string, unknown>): void;
    setDirty?(isDirty: boolean): void;
    setSaving?(isSaving: boolean): void;
    setCanSave?(canSave: boolean): void;
    setErrorMessage?(errorMessage: string): void;
    reset?(): void;
}

/** Props passed to a task configuration component. @dartwic-reference @category Tasks */
export interface TaskConfigProps {
    task: any;
    operation: (...args: any[]) => Promise<any>;
    onSaved?: () => Promise<void> | void;
    onClose?: () => Promise<void> | void;
    openSource?: (...args: any[]) => void;
    taskEditor?: TaskConfigRegistration | null;
}

/** Task type and component registered as a configuration editor. @dartwic-reference @category Tasks */
export interface TaskConfigDefinition {
    taskType: string;
    component: TaskComponent;
}

/** State published to the host by `useTaskConfigBridge`. @dartwic-reference @category Tasks */
export interface TaskConfigBridgeState {
    isDirty?: boolean;
    isSaving?: boolean;
    canSave?: boolean;
    errorMessage?: string;
    saveLabel?: string;
    cancelLabel?: string;
    onSave?: (() => Promise<void> | void) | null;
    onCancel?: (() => Promise<void> | void) | null;
    /** Optional module-instance control rendered by the shared host task-detail body. */
    moduleConnection?: {
        pluginId: string;
        moduleTypeIds?: string[];
        value?: string;
        onValueChange?: (value: string) => void;
        placeholder?: string;
        description?: string;
        showConnectionStatus?: boolean;
    } | null;
}
