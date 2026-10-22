/** Workspace asset access through the connected engine. @dartwic-reference @category Workspace Assets */
export {createWorkspaceAssetClient, workspaceAssetPath, validateWorkspaceAssetPath, WORKSPACE_ASSET_ROOT, pluginWorkspaceAssetPath, createPluginWorkspaceAssetClient, createEnginePluginAssetClient, createInterfacePluginAssetClient} from './client.js';
export type {AssetOperation, WorkspaceAssetClient, PluginWorkspaceAssetClient, BundledAssetClient} from './client.js';
import {getHostApi} from '../internal/host.ts';
import {createInterfacePluginAssetClient as createBundledReader} from './client.js';
import type {BundledAssetClient} from './client.js';

/** Read files shipped in this Interface plugin's assets folder. Call after runtime registration, passing the manifest ID. Resolves the current host adapter automatically. Read-only UTF-8/JSON; updates replace the files. Missing files, invalid paths and invalid JSON reject. @dartwic-reference @category Workspace Assets */
export function createBundledPluginAssetClient(pluginId: string): BundledAssetClient {
    return createBundledReader(getHostApi().readPluginFile, pluginId);
}
