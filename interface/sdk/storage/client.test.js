import test from 'node:test';
import assert from 'node:assert/strict';
import {createStorageClient, instancePath, workspacePath, projectPath, projectSettingsPath, projectCachePath} from './client.js';

test('references preserve instance/project boundaries and allow ordinary relative files', () => {
    assert.deepEqual(instancePath('custom/settings.json'), {rootDir: 'engine_directory', path: 'custom/settings.json'});
    assert.deepEqual(projectPath('modules/pump.json', 'flight'), {rootDir: 'workspace_directory', path: 'flight/modules/pump.json'});
    assert.equal(projectSettingsPath('peers.json', 'flight').path, 'settings/flight/peers.json');
    assert.equal(projectCachePath('model.json', 'flight').path, 'cache/flight/model.json');
    assert.throws(() => workspacePath('../config.json'));
    assert.throws(() => instancePath('C:\\private.json'));
    assert.throws(() => projectPath('modules/pump.json', '../flight'));
});
test('JSON and settings helpers use real named-root operations and surface failures', async () => {
    const calls = [];
    const client = createStorageClient(async (name, payload) => {
        calls.push({name, payload});
        return {payload: name === 'dartwic/get-file' ? {content: '{"rate":10}'} : {effective: {rate: 10}}};
    });
    assert.deepEqual(await client.readJson(projectPath('pump.json')), {rate: 10});
    await client.writeJson(instancePath('custom/pump.json'), {rate: 20});
    assert.equal(calls[1].payload.rootDir, 'engine_directory');
    assert.equal(JSON.parse(calls[1].payload.content).rate, 20);
    await client.resetSettingsOverride('project', ['/plugins/pump/rate'], {project: 'flight'});
    assert.deepEqual(calls[2].payload.reset, ['/plugins/pump/rate']);
    assert.equal(calls[2].payload.project, 'flight');
    const unavailable = createStorageClient(async () => ({error: true, payload: {error: 'Not permitted'}}));
    await assert.rejects(unavailable.readText(instancePath('config.json')), /Not permitted/);
});
