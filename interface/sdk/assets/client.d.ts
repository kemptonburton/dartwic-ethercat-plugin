/** Named root containing shared workspace assets. @dartwic-reference @category Workspace Assets */
export const WORKSPACE_ASSET_ROOT: 'workspace_assets_directory';
/** Engine operation callback used by asset helpers. @dartwic-reference @category Workspace Assets */
export type AssetOperation = (name: string, payload: Record<string, unknown>) => Promise<{error?: boolean; payload?: {content?: string; error?: string}}>;
/** Build a portable assets/namespace/filename reference. Validated single segments, a filename extension and no traversal; throws on invalid input. No I/O. @dartwic-reference @category Workspace Assets */
export function workspaceAssetPath(namespace: string, name: string): string;
/** Validate and normalize a shared asset path. @dartwic-reference @category Workspace Assets */
export function validateWorkspaceAssetPath(path: string): string;
/** Create shared UTF-8/JSON readers and writers. Reads cache per callback; failed reads are evicted. Writes require administrator authority and resolve after the Engine write completes. invalidate evicts external edits. Missing files and invalid JSON reject; no real-time bound. @dartwic-reference @category Workspace Assets */
export function createWorkspaceAssetClient(operation: AssetOperation): WorkspaceAssetClient;
/** Shared authored UTF-8/JSON file operations. Stored paths are workspace-relative assets/... references. @dartwic-reference @category Workspace Assets */
export interface WorkspaceAssetClient {
    /** Read a portable reference; missing or unauthorized files reject. */
    readText(path: string): Promise<string>;
    /** Read and parse JSON without runtime schema validation. */
    readJson<T = unknown>(path: string): Promise<T>;
    /** Save namespace/file atomically and return its portable reference. */
    saveText(namespace: string, name: string, content: string): Promise<string>;
    /** Serialize JSON, save it and return its portable reference. */
    saveJson(namespace: string, name: string, value: unknown): Promise<string>;
    /** Evict a cached reference after an external change. */
    invalidate(path: string): void;
}

/** Build assets/plugins/id/relative for shared authored files. Bind the manifest plugin ID; relative files may have validated subdirectories and must have an extension. No I/O or isolation from generic storage APIs. @dartwic-reference @category Workspace Assets */
export function pluginWorkspaceAssetPath(pluginId: string, relative: string): string;
/** Authored plugin files confined by these helpers to workspace/assets/plugins/id. Project settings, secrets and runtime retain their scopes. @dartwic-reference @category Workspace Assets */
export interface PluginWorkspaceAssetClient {
    /** Return a portable reference without I/O. */
    path(relative: string): string;
    /** Read UTF-8; missing/unauthorized files reject. Cached per callback. */
    readText(relative: string): Promise<string>;
    /** Read JSON; the generic type adds no runtime schema validation. */
    readJson<T = unknown>(relative: string): Promise<T>;
    /** Atomically save text, then return its portable reference. Requires administrator authority. */
    saveText(relative: string, content: string): Promise<string>;
    /** Serialize and save JSON, returning its portable reference. */
    saveJson(relative: string, value: unknown): Promise<string>;
    /** Evict a cached relative file after an external change. */
    invalidate(relative: string): void;
}
/** Bind authored-file helpers once to a validated manifest plugin ID. Completion means the Engine operation finished; I/O may block without a real-time bound. @dartwic-reference @category Workspace Assets */
export function createPluginWorkspaceAssetClient(operation: AssetOperation, pluginId: string): PluginWorkspaceAssetClient;
/** Read-only bundled UTF-8/JSON files. Updates replace them. Missing files and invalid JSON reject; no caching or real-time bound. @dartwic-reference @category Workspace Assets */
export interface BundledAssetClient {
    /** Read a validated path relative to the plugin assets folder. */
    readText(relative: string): Promise<string>;
    /** Read JSON without runtime schema validation. */
    readJson<T = unknown>(relative: string): Promise<T>;
}
/** Read engine/plugins/id/assets through the connected Engine, retaining its authorization. No writes. @dartwic-reference @category Workspace Assets */
export function createEnginePluginAssetClient(operation: AssetOperation, pluginId: string): BundledAssetClient;
/** Read interface/plugins/id/assets using the Interface host installed-plugin file reader. No Engine installation is required. @dartwic-reference @category Workspace Assets */
export function createInterfacePluginAssetClient(readPluginFile: (pluginId: string, relative: string) => Promise<string>, pluginId: string): BundledAssetClient;
