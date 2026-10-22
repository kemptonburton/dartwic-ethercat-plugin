import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceAssetClient, workspaceAssetPath, createPluginWorkspaceAssetClient, createEnginePluginAssetClient, createInterfacePluginAssetClient, pluginWorkspaceAssetPath} from './client.js';
test('shared assets use the same workspace root for reads and writes, with portable references', async () => {
    const calls = [], files = new Map();
    const operation = async (name, args) => {
        calls.push({name, args});
        if (name === 'dartwic/save-file') {files.set(args.path, args.content); return {payload: {}};}
        return {payload: {content: files.get(args.filePath)}};
    };
    const assets = createWorkspaceAssetClient(operation);
    const path = await assets.saveJson('example_plugin', 'drawing.json', {source: 'image'});
    assert.equal(path, 'assets/example_plugin/drawing.json');
    assets.invalidate(path);
    assert.deepEqual(await assets.readJson(path), {source: 'image'});
    await Promise.all([assets.readText(path), createWorkspaceAssetClient(operation).readText(path)]);
    assert.equal(calls.length, 2);
    assert.ok(calls.every(call => call.args.rootDir === 'workspace_assets_directory'));
});
test('unsafe paths and failed saves are rejected; failed reads can be retried', async () => {
    for (const [namespace, name] of [['../models', 'asset.json'], ['models', '../asset.json'], ['models', 'nested/asset.json'], ['models', 'asset']])
        assert.throws(() => workspaceAssetPath(namespace, name));
    let fail = true, reads = 0;
    const assets = createWorkspaceAssetClient(async name => {
        if (name === 'dartwic/get-file') reads++;
        return fail ? {error: true, payload: {error: 'Disk unavailable'}} : {payload: {content: '{}'}};
    });
    await assert.rejects(assets.saveJson('media', 'test.json', {}), /Disk unavailable/);
    await assert.rejects(assets.readJson('assets/media/test.json'), /Disk unavailable/);
    fail = false;
    assert.deepEqual(await assets.readJson('assets/media/test.json'), {});
    assert.equal(reads, 2);
    await assert.rejects(assets.readText('assets/media/../../workspace.json'), /Invalid workspace/);
});

test('plugin helpers bind an ID, preserve portable paths and keep managed bundles read-only', async () => {
    const files = new Map(), calls = [];
    const operation = async (name, args) => {
        calls.push({name,args});
        if (name === 'dartwic/save-file') {files.set(args.path,args.content);return {payload:{}};}
        return {payload:{content:files.get(args.filePath) ?? '{"bundled":true}'}};
    };
    const custom = createPluginWorkspaceAssetClient(operation,'example_plugin');
    assert.equal(await custom.saveJson('layouts/main.json',{custom:true}),'assets/plugins/example_plugin/layouts/main.json');
    assert.deepEqual(await custom.readJson('layouts/main.json'),{custom:true});
    assert.equal(calls[0].args.path,'plugins/example_plugin/layouts/main.json');
    for (const bad of ['../other.json','/absolute.json','folder/../../secret.json']) assert.throws(() => custom.path(bad));
    for (const id of ['../outside','a/b','']) assert.throws(() => pluginWorkspaceAssetPath(id,'settings.json'));
    const managed = createEnginePluginAssetClient(operation,'example_plugin');
    assert.deepEqual(await managed.readJson('labels.json'),{bundled:true});
    assert.equal(calls.at(-1).args.filePath,'plugins/example_plugin/assets/labels.json');
    assert.equal(managed.saveText,undefined);
    const interfaceFiles = createInterfacePluginAssetClient(async (id,file) => JSON.stringify({id,file}),'example_plugin');
    assert.deepEqual(await interfaceFiles.readJson('labels.json'),{id:'example_plugin',file:'assets/labels.json'});
});
