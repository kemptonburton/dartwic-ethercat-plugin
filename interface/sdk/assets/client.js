/** Shared, workspace-wide assets. References contain paths, never machine-specific directories. */
export const WORKSPACE_ASSET_ROOT = 'global_data_directory';
export function workspaceAssetPath(namespace, name) {
    if (!/^[a-z0-9][a-z0-9_.-]*$/i.test(namespace) || !/^[a-z0-9][a-z0-9_.-]*$/i.test(name)
        || namespace.includes('..') || name.includes('..') || !name.includes('.')) throw new Error('Asset namespace and filename must be safe single path segments, with a file extension.');
    return `assets/${namespace}/${name}`;
}
export function validateWorkspaceAssetPath(path) {
    const parts = String(path ?? '').split('/');
    if (parts.length !== 3 || parts[0] !== 'assets' || workspaceAssetPath(parts[1], parts[2]) !== path)
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
        if (!cache.has(path)) remember(path, operation('dartwic/get-file', {rootDir: WORKSPACE_ASSET_ROOT, filePath: path})
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
        check(await operation('dartwic/save-file', {rootDir: WORKSPACE_ASSET_ROOT, path, content}));
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
