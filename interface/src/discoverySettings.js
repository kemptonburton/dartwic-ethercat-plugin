import {createStorageClient} from '../sdk/storage/client.js';

// These plugins consume discovery policy at startup; saving does not restart hardware.
export function createDiscoverySettingsAdapter(pluginId) {
    const load = async ({operation}) => {
        const inventory = await operation('dartwic/plugins/list-installed-engine-plugins', {}, 10000);
        if (!inventory || inventory.error) throw new Error(inventory?.payload?.error || 'Could not locate the installed plugin.');
        const folder = inventory.payload?.plugins?.find(plugin => plugin.id === pluginId)?.folder;
        if (!folder) throw new Error('The Engine plugin is not installed.');
        const storage = createStorageClient(operation);
        const manifest = await storage.readJson({rootDir: folder, path: 'plugin.json'});
        const snapshot = await storage.readEffectiveSettings({plugins: {[pluginId]: manifest}});
        return {
            revision: snapshot.revision,
            device_discovery: snapshot.effective.plugins[pluginId].device_discovery,
            projectOverrides: snapshot.project?.plugins?.[pluginId]?.device_discovery || {},
        };
    };
    return {load, async apply(next, previous, context) {
        const patch = Object.fromEntries(Object.entries(next.device_discovery)
            .filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(previous.device_discovery[key])));
        for (const key of Object.keys(patch)) {
            if (Object.hasOwn(previous.projectOverrides, key))
                throw new Error(`Discovery setting ${key} is overridden by this project. Remove its project override before editing the workspace setting.`);
        }
        if (!Object.keys(patch).length) return previous;
        await createStorageClient(context.operation).writeSettingsOverride('workspace',
            {plugins: {[pluginId]: {device_discovery: patch}}}, {revision: previous.revision});
        try { return await load(context); }
        catch (error) {
            throw new Error(`Settings saved; refresh failed: ${error.message}. Refresh to reconcile. Engine restart required.`);
        }
    }};
}
