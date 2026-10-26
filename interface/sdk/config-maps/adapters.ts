import type {ConfigMapDefinition} from './index.ts';

async function request(context: any, name: string, payload: any = {}) {
    const result = await context.operation(name, payload, 30000);
    if (!result || result.error) throw new Error(result?.payload?.error || `Failed: ${name}`);
    return result.payload;
}
function changed(...kinds: string[]) {
    if (typeof window !== 'undefined') for (const kind of kinds) window.dispatchEvent(new CustomEvent(`dartwic:${kind}-changed`));
}
async function moduleSource(context: any) {
    const name = context.module?.name || context.instanceConfig?.name;
    const inventory = await request(context, 'dartwic/get-module-instances');
    const module = inventory.module_instances?.find((item: any) => item.name === name);
    if (!module?.resource_path) throw new Error(`Module ${name} is unavailable.`);
    const path = String(module.resource_path).replace(/\\/g, '/');
    return {name, path: path.startsWith('modules/') ? path : `modules/${path}`};
}

/** Use the existing module JSON resource and detached save/reload job. Completion includes reload/rebinding and a fresh read; failures reject, and timeouts require observation before retry. No new storage is created. Configuration-time I/O only. @dartwic-reference @category Config Map */
export function createModuleConfigAdapter(): Pick<ConfigMapDefinition, 'load' | 'apply'> {
    const load = async (context: any) => {
        const source = await moduleSource(context);
        const file = await request(context, 'dartwic/get-file', {rootDir: 'projects_directory', filePath: source.path});
        return JSON.parse(file.content);
    };
    return {load, async apply(next, previous, context) {
        const source = await moduleSource(context);
        if (next.name !== previous.name || next.name !== source.name) throw new Error('Rename modules through the resource editor.');
        const started = await request(context, 'dartwic/modules/save-and-reload-module-instance/start', {
            rootDir: 'projects_directory', path: source.path, content: JSON.stringify(next, null, 2), instanceName: source.name,
        });
        const jobId = started.job_id || started.id;
        if (!jobId) throw new Error('Module reload returned no job ID. Refresh before retrying.');
        const deadline = Date.now() + 120000;
        for (;;) {
            const status = await request(context, 'tempest/job-status', {job_id: jobId});
            const job = status.job || status;
            if (['failed', 'canceled', 'cancelled'].includes(job.state)) throw new Error(job.error || job.message || 'Module reload failed.');
            if (job.state === 'completed') {
                if (job.result?.error) throw new Error(job.result?.payload?.error || 'Module reload failed.');
                break;
            }
            if (Date.now() >= deadline) throw new Error('Module reload outcome is unknown; refresh before retrying.');
            await new Promise((resolve) => globalThis.setTimeout(resolve, 250));
        }
        const accepted = await load(context);
        changed('modules', 'tasks', 'channels');
        return accepted;
    }};
}

/** Edit an existing task through the Engine's configuration/recovery path with expected-argument conflict detection. Preserve metadata; the Engine owns running/hold restoration. Resolve after application and a fresh observation, or reject. No new storage is created. @dartwic-reference @category Config Map */
export function createTaskConfigAdapter(): Pick<ConfigMapDefinition, 'load' | 'apply'> {
    const load = async (context: any) => {
        const inventory = await request(context, 'dartwic/get-registered-tasks', {query: '', limit: 0});
        const task = inventory.tasks?.find((item: any) => item.name === context.task?.name);
        if (!task) throw new Error(`Task ${context.task?.name} is unavailable.`);
        return task;
    };
    return {load, async apply(next, previous, context) {
        if (next.name !== previous.name || next.task_type !== previous.task_type) throw new Error('Change task identity through the task resource.');
        await request(context, 'dartwic/create-task', {task_name: next.name, task_type: next.task_type,
            portal_name: next.portal, metadata: next.metadata || {}, arguments: next.arguments, expected_arguments: previous.arguments});
        const accepted = await load(context);
        changed('tasks', 'channels');
        return accepted;
    }};
}
