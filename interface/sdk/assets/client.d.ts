/** Named root containing shared workspace assets. @dartwic-reference @category Workspace Assets */
export const WORKSPACE_ASSET_ROOT: 'global_data_directory';
/** Engine operation callback used by asset helpers. @dartwic-reference @category Workspace Assets */
export type AssetOperation = (name: string, payload: Record<string, unknown>) => Promise<{error?: boolean; payload?: {content?: string; error?: string}}>;
/** Build a validated namespace/name path in shared assets. @dartwic-reference @category Workspace Assets */
export function workspaceAssetPath(namespace: string, name: string): string;
/** Validate and normalize a shared asset path. @dartwic-reference @category Workspace Assets */
export function validateWorkspaceAssetPath(path: string): string;
/** Create shared asset readers and writers with a local read cache. @dartwic-reference @category Workspace Assets */
export function createWorkspaceAssetClient(operation: AssetOperation): {
    readText(path: string): Promise<string>;
    readJson<T = unknown>(path: string): Promise<T>;
    saveText(namespace: string, name: string, content: string): Promise<string>;
    saveJson(namespace: string, name: string, value: unknown): Promise<string>;
    invalidate(path: string): void;
};
