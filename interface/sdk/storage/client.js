function relativePath(value = '') {
    const path = String(value).replaceAll('\\', '/');
    if (path.startsWith('/') || path.includes(':') || path.split('/').includes('..'))
        throw new Error('Use a relative path inside the selected storage root.');
    return path;
}
function projectName(value) {
    if (!value || /[\\/:<>"|?*]/.test(value) || value === '.' || value === '..') throw new Error('Provide a valid project name.');
    return value;
}
function reference(rootDir, path) { return {rootDir, path: relativePath(path)}; }
export const installationPath = path => reference('installation_directory', path);
export const instancePath = path => reference('engine_directory', path);
export const workspacePath = path => reference('workspace_directory', path);
export function projectPath(path, project = '') {
    return project ? workspacePath(`${projectName(project)}/${relativePath(path)}`) : reference('projects_directory', path);
}
export const projectSettingsPath = (path, project) => instancePath(`settings/${projectName(project)}/${relativePath(path)}`);
export const projectRuntimePath = (path, project) => instancePath(`runtime/${projectName(project)}/${relativePath(path)}`);
export const projectCachePath = (path, project) => instancePath(`cache/${projectName(project)}/${relativePath(path)}`);

export function createStorageClient(operation) {
    const call = async (name, payload) => {
        const response = await operation(name, payload);
        if (!response || response.error) throw new Error(response?.payload?.error || 'Storage operation failed.');
        return response.payload;
    };
    const readText = async ref => (await call('dartwic/get-file', {rootDir: ref.rootDir, filePath: relativePath(ref.path)})).content;
    const writeText = async (ref, content) => {
        if (typeof content !== 'string') throw new Error('File content must be text.');
        await call('dartwic/save-file', {rootDir: ref.rootDir, path: relativePath(ref.path), content});
        return ref;
    };
    const writeSettingsOverride = (scope, patch, {reset = [], project = '', revision = ''} = {}) =>
        call('dartwic/settings/configure', {scope, patch, reset, project, revision});
    return {
        readText, writeText,
        async readJson(ref) { return JSON.parse(await readText(ref)); },
        async writeJson(ref, value) { return writeText(ref, JSON.stringify(value, null, 2) + '\n'); },
        readEffectiveSettings(defaults = {}, project = '') { return call('dartwic/settings/get', {defaults, project}); },
        writeSettingsOverride,
        resetSettingsOverride(scope, reset, options = {}) { return writeSettingsOverride(scope, {}, {...options, reset}); },
    };
}
