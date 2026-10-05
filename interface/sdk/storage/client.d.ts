/** A named engine root and relative file path. @dartwic-reference @category Storage */
export interface FileReference { rootDir: string; path: string; }
/** Effective settings, overrides, leaf sources, and an opaque revision. @dartwic-reference @category Storage */
export interface SettingsSnapshot { effective: Record<string, any>; workspace: Record<string, any>; project: Record<string, any>; sources: Record<string, string>; revision: string; }
/** Scoped file access and layered workspace/project settings. @dartwic-reference @category Storage */
export interface StorageClient {
    readText(ref: FileReference): Promise<string>;
    writeText(ref: FileReference, content: string): Promise<FileReference>;
    readJson(ref: FileReference): Promise<any>;
    writeJson(ref: FileReference, value: any): Promise<FileReference>;
    readEffectiveSettings(defaults?: Record<string, any>, project?: string): Promise<SettingsSnapshot>;
    writeSettingsOverride(scope: 'workspace' | 'project', patch: Record<string, any>, options?: {reset?: string[]; project?: string; revision?: string}): Promise<SettingsSnapshot>;
    resetSettingsOverride(scope: 'workspace' | 'project', reset: string[], options?: {project?: string; revision?: string}): Promise<SettingsSnapshot>;
}
/** Reference an installation file. @dartwic-reference @category Storage */
export function installationPath(path?: string): FileReference;
/** Reference a private engine-instance file. @dartwic-reference @category Storage */
export function instancePath(path?: string): FileReference;
/** Reference a portable workspace file. @dartwic-reference @category Storage */
export function workspacePath(path?: string): FileReference;
/** Reference a portable project file; omission selects the active project. @dartwic-reference @category Storage */
export function projectPath(path?: string, project?: string): FileReference;
/** Reference durable private settings for a named project. @dartwic-reference @category Storage */
export function projectSettingsPath(path: string, project: string): FileReference;
/** Reference private runtime data for a named project. @dartwic-reference @category Storage */
export function projectRuntimePath(path: string, project: string): FileReference;
/** Reference disposable cache data for a named project. @dartwic-reference @category Storage */
export function projectCachePath(path: string, project: string): FileReference;
/** Create helpers using the host operation callback; existing permissions still apply. @dartwic-reference @category Storage */
export function createStorageClient(operation: (name: string, payload: any) => Promise<any>): StorageClient;
