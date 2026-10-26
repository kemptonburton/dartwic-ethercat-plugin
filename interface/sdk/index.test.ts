import test from "node:test";
import assert from "node:assert/strict";
import {createInterfacePlugin, definePlugin} from "./index.ts";
import {getConfigMapChannels} from "./config-maps/index.ts";
import {defineMarkdownChip} from "./markdown/index.ts";

const Component = () => null;

test('Config Map registrations create default editors and preserve custom components', () => {
    const configMap = {groups: [], load: async () => ({}), apply: async (next: any) => next};
    const plugin = createInterfacePlugin({id: 'driver', register(registry) {
        registry.addModuleUi({id: 'device', name: 'Device', configMap});
        registry.addTaskUi({id: 'read', name: 'Read', configMap});
        registry.addSettingsPanel({id: 'discovery', name: 'Discovery', configMap});
        registry.addTaskUi({id: 'custom', name: 'Custom', editor: Component, configMap});
        registry.addModuleUi({id: 'custom', name: 'Custom', panel: Component, configMap});
        registry.addSettingsPanel({id: 'custom', name: 'Custom', component: Component, configMap});
        registry.addTaskUi({id: 'plain', name: 'Plain', editor: Component});
    }});
    assert.equal(typeof plugin.moduleUis['driver.device'].panel, 'function');
    assert.equal(typeof plugin.taskEditors['driver.read'].component, 'function');
    assert.equal(typeof plugin.settingsPanels[0].component, 'function');
    assert.equal(plugin.taskEditors['driver.read'].configMap, configMap);
    assert.equal(plugin.taskEditors['driver.custom'].component, Component);
    assert.equal(plugin.taskEditors['driver.custom'].customConfigMapLayout, true);
    assert.equal(plugin.moduleUis['driver.custom'].customConfigMapLayout, true);
    assert.equal(plugin.settingsPanels[1].customConfigMapLayout, true);
    assert.equal(plugin.taskEditors['driver.read'].customConfigMapLayout, false);
    assert.equal(plugin.taskEditors['driver.plain'].component, Component);
    assert.equal(plugin.taskEditors['driver.plain'].configMap, undefined);
});

test("value formats register namespaced display and editor contributions", () => {
    const plugin = createInterfacePlugin({id: "example", register(registry) {
        registry.addValueFormat({id: "percent", name: "Percentage", format: (value) => `${value * 100}%`, parse: Number, Editor: Component});
    }});
    assert.equal(plugin.valueFormats["example.percent"].format(.5), "50%");
    assert.equal(plugin.valueFormats["example.percent"].Editor, Component);
    assert.equal(plugin.contributions.interface.valueFormats[0].id, "example.percent");
});

test("resourceName preserves a stable runtime identity while contribution ids remain namespaced", () => {
    const plugin = createInterfacePlugin(definePlugin({
        id: "checklists",
        register(registry) {
            registry.addResource({id: "editor", name: "Checklists", resourceName: "checklists", type: "directory", icon: Component, component: Component});
        }
    }));
    assert.equal(plugin.resources[0].name, "checklists");
    assert.equal(plugin.resources[0].resourceName, "checklists");
    assert.equal(plugin.contributions.interface.resources[0].id, "checklists.editor");
});

test("unsafe and duplicate runtime resource names are rejected", () => {
    assert.throws(() => createInterfacePlugin({id: "bad", register(registry) {
        registry.addResource({id: "one", name: "One", resourceName: "../checklists", type: "component", icon: Component, component: Component});
    }}), /safe single path segment/);
    assert.throws(() => createInterfacePlugin({id: "dupe", register(registry) {
        registry.addResource({id: "one", name: "One", resourceName: "same", type: "component", icon: Component, component: Component});
        registry.addResource({id: "two", name: "Two", resourceName: "same", type: "component", icon: Component, component: Component});
    }}), /Duplicate resource runtime name/);
});

test("Markdown chip descriptors require parser, serializer, and renderer", () => {
    const chip = defineMarkdownChip({id: "example", prefix: "@example(", parse: () => null, serialize: String, component: Component});
    assert.equal(chip.id, "example");
    assert.throws(() => defineMarkdownChip({id: "broken"} as never), /requires parse, serialize, and component/);
});

test("popup UIs are plugin-qualified and publish their request/result contract", () => {
    const plugin = createInterfacePlugin(definePlugin({
        id: "scanner",
        register(registry) {
            registry.addPopupUi({
                id: "review",
                name: "Review scan",
                component: Component,
                requestType: "ScanCandidate",
                resultType: "AcceptedScan",
                requestSchema: {type: "object", required: ["address"]},
                resultSchema: {type: "object", required: ["accepted"]},
            });
        },
    }));
    assert.equal(plugin.popupUis["scanner.review"].component, Component);
    assert.deepEqual(plugin.contributions.interface.popupUis[0], {
        id: "scanner.review",
        name: "Review scan",
        requestType: "ScanCandidate",
        resultType: "AcceptedScan",
        requestSchema: {type: "object", required: ["address"]},
        resultSchema: {type: "object", required: ["accepted"]},
    });
});

test('channel traces derive from binding columns including optional readbacks', () => {
    const map = {groups: [{id: 'io', label: 'I/O', tables: [{path: 'arguments.writes', label: 'Writes', columns: [
        {path: 'register', label: 'Address', type: 'number' as const},
        {path: 'channel', label: 'Command', type: 'channel' as const, channelMode: 'read' as const},
        {path: 'readback_channel', label: 'Readback', type: 'channel' as const, channelMode: 'write' as const},
    ]}]}], load: async () => ({}), apply: async (next: any) => next};
    assert.deepEqual(getConfigMapChannels(map, {arguments: {writes: [{register: 3, channel: 'command', readback_channel: 'feedback'}]}}), [
        {name: 'command', direction: 'output', detail: 'Address: 3'},
        {name: 'feedback', direction: 'input', detail: 'Address: 3'},
    ]);
});
