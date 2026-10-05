/** Supported resource presentation modes. @dartwic-reference @category Resources */
export type ResourceType = "component" | "directory";

/** Complete configuration for an interface resource. @dartwic-reference @category Resources */
export interface ResourceDefinition {
    name: string;
    /** Stable runtime, storage, link, tab, and collaboration identity. */
    resourceName?: string;
    label?: string;
    icon?: any;
    type: ResourceType;
    component?: any;
    show_in_resource_tabs?: boolean;
    file_extension?: string;
    file_extensions?: string[];
    excluded_file_names?: string[];
    excluded_paths?: string[];
    show_file_extensions?: boolean;
    enable_directory_resource_groups?: boolean;
    resource_on_create_file_data?: string;
    resource_on_create_file_dialog?: any;
    resource_on_delete_function?: any;
    get_tree_file_icon_src?: any;
    tree_file_icon?: any;
    tree_directory_icon?: any;
    file_icons?: Record<string, any>;
    context_label?: string;
    context_config?: any;
    context_default_content?: any;
}

/** Resource load or save failure state presented by the host. @dartwic-reference @category Resources */
export interface ResourceErrorState {
    error: boolean;
    message: string;
}

/** Options controlling resource save feedback. @dartwic-reference @category Resources */
export interface SaveResourceContentOptions {
    /** Suppresses the successful-save toast. Save failures are still surfaced. */
    silent?: boolean;
}

/** Props supplied by the host to component resource contributions.  @dartwic-reference @category Resources */
export interface ResourceComponentProps {
    resource_name: string;
    resource_config: ResourceDefinition;
    resource_path: string;
    isLoaded: boolean;
    setIsLoaded(value: boolean): void;
    errorState: ResourceErrorState;
    setErrorState(value: ResourceErrorState | ((previous: ResourceErrorState) => ResourceErrorState)): void;
    getResourceContent(): Promise<string | null>;
    saveResourceContent(content: string, options?: SaveResourceContentOptions): Promise<unknown>;
    onLiveResourceChange(handler: (telemetry: unknown) => void): () => void;
    sendLiveResourceChange(payload?: Record<string, unknown>): Promise<unknown>;
    onLiveResourcePresence(handler: (telemetry: unknown) => void): () => void;
    sendLiveResourcePresence(payload?: Record<string, unknown>): Promise<unknown>;
    sendResourceSyncStatus(payload?: Record<string, unknown>): Promise<unknown>;
}
