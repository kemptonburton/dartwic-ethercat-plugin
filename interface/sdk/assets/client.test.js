import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceAssetClient, workspaceAssetPath} from './client.js';
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
    assert.ok(calls.every(call => call.args.rootDir === 'global_data_directory'));
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
