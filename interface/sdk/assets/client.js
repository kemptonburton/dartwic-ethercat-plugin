/** Shared, workspace-wide assets. References contain paths, never machine-specific directories. */
export const WORKSPACE_ASSET_ROOT = 'workspace_assets_directory';
export function workspaceAssetPath(namespace, name) {
    if (!/^[a-z0-9][a-z0-9_.-]*$/i.test(namespace) || !/^[a-z0-9][a-z0-9_.-]*$/i.test(name)
        || namespace.includes('..') || name.includes('..') || namespace.endsWith('.') || name.endsWith('.') || !name.includes('.')) throw new Error('Asset namespace and filename must be safe single path segments, with a file extension.');
    return `assets/${namespace}/${name}`;
}
export function validateWorkspaceAssetPath(path) {
    const parts = String(path ?? '').split('/');
    const plugin = parts[1] === 'plugins' && parts.length >= 4;
    if ((!plugin && parts.length !== 3) || parts[0] !== 'assets' || parts.slice(1).some(part => !/^[a-z0-9][a-z0-9_.-]*$/i.test(part) || part.includes('..') || part.endsWith('.')) || !parts.at(-1)?.includes('.'))
        throw new Error('Invalid workspace asset reference.');
    return path;
}
const caches = new WeakMap();
export function createWorkspaceAssetClient(operation) {
    let cache = caches.get(operation);
    if (!cache) {cache = new Map(); caches.set(operation, cache);}
    const check = result => {
        if (!result || result.error) throw new Error(result?.payload?.error || 'Workspace asset operation failed.');
        return result.payload;
    };
    const remember = (path, value) => {
        cache.set(path, value);
        if (cache.size > 12) cache.delete(cache.keys().next().value);
        return value;
    };
    const readText = async path => {
        validateWorkspaceAssetPath(path);
        if (!cache.has(path)) remember(path, operation('dartwic/get-file', {rootDir: WORKSPACE_ASSET_ROOT, filePath: path.slice(7)})
            .then(result => {
                const content = check(result)?.content;
                if (typeof content !== 'string') throw new Error('Workspace asset response contains no text.');
                return content;
            }).catch(error => {cache.delete(path); throw error;}));
        return cache.get(path);
    };
    const saveText = async (namespace, name, content) => {
        const path = workspaceAssetPath(namespace, name);
        if (typeof content !== 'string') throw new Error('Workspace asset content must be text.');
        check(await operation('dartwic/save-file', {rootDir: WORKSPACE_ASSET_ROOT, path: path.slice(7), content}));
        remember(path, Promise.resolve(content));
        return path;
    };
    return {
        readText,
        async readJson(path) {return JSON.parse(await readText(path));},
        saveText,
        async saveJson(namespace, name, value) {return saveText(namespace, name, JSON.stringify(value));},
        invalidate(path) {cache.delete(validateWorkspaceAssetPath(path));},
    };
}

/** Portable authored file reference. Plugin IDs and every path segment are validated. */
export function pluginWorkspaceAssetPath(pluginId, relative) {
    workspaceAssetPath(pluginId, 'validation.json');
    const path = `assets/plugins/${pluginId}/${relative}`;
    validateWorkspaceAssetPath(path);
    return path;
}

/** Bind once to the registered plugin ID; successful writes finish at the Engine. */
export function createPluginWorkspaceAssetClient(operation, pluginId) {
    pluginWorkspaceAssetPath(pluginId, 'settings.json');
    const storage = createWorkspaceAssetClient(operation);
    const reference = relative => pluginWorkspaceAssetPath(pluginId, relative);
    const saveText = async (relative, content) => {
        if (typeof content !== 'string') throw new Error('Plugin asset content must be text.');
        const path = reference(relative);
        const result = await operation('dartwic/save-file', {rootDir: WORKSPACE_ASSET_ROOT, path: path.slice(7), content});
        if (!result || result.error) throw new Error(result?.payload?.error || 'Plugin asset write failed.');
        storage.invalidate(path);
        return path;
    };
    return {
        path: reference,
        readText: relative => storage.readText(reference(relative)),
        readJson: relative => storage.readJson(reference(relative)),
        saveText,
        saveJson: (relative, value) => saveText(relative, JSON.stringify(value, null, 2) + '\n'),
        invalidate: relative => storage.invalidate(reference(relative)),
    };
}

/** Read UTF-8 files shipped with an installed Engine plugin; no write operations. */
export function createEnginePluginAssetClient(operation, pluginId) {
    pluginWorkspaceAssetPath(pluginId, 'settings.json');
    const readText = async relative => {
        const path = pluginWorkspaceAssetPath(pluginId, relative).replace('assets/plugins/', 'plugins/');
        const pieces = path.split('/'); pieces.splice(2, 0, 'assets');
        const result = await operation('dartwic/get-file', {rootDir: 'installation_directory', filePath: pieces.join('/')});
        if (!result || result.error || typeof result.payload?.content !== 'string') throw new Error(result?.payload?.error || 'Bundled plugin asset read failed.');
        return result.payload.content;
    };
    return {readText, readJson: async relative => JSON.parse(await readText(relative))};
}

/** Read UTF-8 assets from an Interface plugin through its host's file reader. */
export function createInterfacePluginAssetClient(readPluginFile, pluginId) {
    pluginWorkspaceAssetPath(pluginId, 'settings.json');
    const readText = async relative => {
        pluginWorkspaceAssetPath(pluginId, relative);
        return readPluginFile(pluginId, `assets/${relative}`);
    };
    return {readText, readJson: async relative => JSON.parse(await readText(relative))};
}
