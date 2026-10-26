import {createHostComponent} from '../internal/createHostComponent.ts';
export {createModuleConfigAdapter, createTaskConfigAdapter} from './adapters.ts';

/** One reusable cell. Standalone editors commit text/numbers on Enter and selections immediately; resource sheets use Apply, while plugin settings save on blur. Validation is synchronous; persistence and device application belong to the adapter. @dartwic-reference @category Config Map */
export interface ConfigMapField {
    path: string;
    label: string;
    type?: 'text' | 'number' | 'select' | 'toggle' | 'module' | 'channel';
    required?: boolean;
    /** Missing-value display/default; may be a pure (document, row) function for native defaults such as derived readback names. */
    defaultValue?: any;
    min?: number;
    max?: number;
    integer?: boolean;
    placeholder?: string;
    description?: string;
    /** Hidden metadata is still validated and searchable, but is not drawn as a column. */
    hidden?: boolean;
    options?: Array<{value: string; label: string}>;
    pluginId?: string;
    moduleTypeIds?: string[];
    /** Optional selector hint matching the native configured-task limit; zero/omitted is unlimited. Engine validation remains authoritative. */
    maxTasksPerModule?: number;
    channelMode?: 'read' | 'write' | ((document: any, row?: any) => 'read' | 'write');
    parse?(raw: string): any;
    validate?(value: any, document: any, context: any): string;
    /** Custom cell must call onDraft for text changes and onCommit only for explicit acceptance. */
    render?(props: {value: any; draft: any; path: string; document: any; row?: any;
        onDraft(value: any): void; onDraftAt(path: string, value: any): void; onCommit(value: any): void; context: any; disabled: boolean}): any;
}
/** Repeatable hardware/channel bindings. New rows are local drafts until required cells are committed. @dartwic-reference @category Config Map */
export interface ConfigMapTable {
    path: string;
    label: string;
    columns: ConfigMapField[];
    createRow?(): Record<string, any>;
}
/** A single declaration shared by resource editors and Module Map, without another persistent configuration store. load returns the existing full document; the host edits declared paths and preserves other fields. apply must resolve only after existing persistence and the resource's application policy complete, or reject with an actionable error. Return the accepted document, or omit the result to accept next. Context supplies operation and the resource identity (module, task, or plugin). No restart behavior is implied. @dartwic-reference @category Config Map */
export interface ConfigMapDefinition {
    title?: string;
    groups: Array<{id: string; label: string; fields?: ConfigMapField[]; tables?: ConfigMapTable[]}>;
    load(context: any): Promise<any>;
    apply(next: any, previous: any, context: any): Promise<any>;
    validate?(value: any, context: any): string;
}
/** Props for session-shared configuration editing; resourceKey must uniquely identify one resource within a connection. @dartwic-reference @category Config Map */
export interface ConfigMapProps extends Record<string, unknown> {
    /** Required standalone; inherited inside a registered custom module/task/settings editor. */
    definition?: ConfigMapDefinition;
    /** Required standalone; inherited inside a registered custom editor. Use the same key for every view of one document. */
    resourceKey?: string;
    context?: Record<string, any>;
    /** Render selected group IDs from the full definition. All views still share its one session, validation and adapter. */
    groupIds?: string[];
}
/** Defines optional configuration metadata without creating or changing resources. @dartwic-reference @category Config Map */
export function defineConfigMap(definition: ConfigMapDefinition): ConfigMapDefinition { return definition; }
/** Derives channel trace rows from declared channel fields and binding columns, for ModuleRuntimeOverview or custom summaries. channelMode write means a device input published to RAPID; read means a RAPID command consumed by the device. @dartwic-reference @category Config Map */
export function getConfigMapChannels(definition: ConfigMapDefinition, document: any): Array<{name: string; direction: 'input' | 'output'; detail: string}> {
    const at = (path: string) => path.split('.').reduce((value, key) => value?.[key], document);
    const result: Array<{name: string; direction: 'input' | 'output'; detail: string}> = [];
    const add = (field: ConfigMapField, value: any, detail: string, row?: any) => {
        value ??= typeof field.defaultValue === 'function' ? field.defaultValue(document, row) : field.defaultValue;
        if (field.type === 'channel' && typeof value === 'string' && value.trim())
            result.push({name: value, direction: (typeof field.channelMode === 'function' ? field.channelMode(document, row) : field.channelMode) === 'write' ? 'input' : 'output', detail});
    };
    for (const group of definition.groups) {
        for (const field of group.fields || []) add(field, at(field.path), field.label);
        for (const table of group.tables || []) {
            for (const row of at(table.path) || []) {
                const detail = table.columns.filter((column) => column.type !== 'channel')
                    .map((column) => `${column.label}: ${row[column.path] ?? ''}`).join(' · ');
                for (const column of table.columns) add(column, row[column.path], detail, row);
            }
        }
    }
    return result;
}
/** Host configuration table with connection-scoped shared drafts and serialized application through its adapter. Standalone text commits on Enter; registered module/task sheets use Apply and plugin settings save on blur. Requires a host exposing ConfigMap. @dartwic-reference @category Config Map */
export const ConfigMap = createHostComponent<ConfigMapProps>('ConfigMap', (hostApi) => hostApi.components.ConfigMap);
