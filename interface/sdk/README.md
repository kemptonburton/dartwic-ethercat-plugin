# Interface Plugin SDK

The DARTWIC 2.0 interface SDK has one authoring pattern: define a plugin and register each contribution through the registry passed to `register`.

```jsx
import {definePlugin} from "@dartwic/interface-sdk";

export default definePlugin({
  id: "my_plugin",
  name: "My Plugin",
  register(registry) {
    registry.addTaskUi({id: "read", name: "Read Task", card: ReadCard, editor: ReadEditor});
    registry.addModuleUi({
      id: "device",
      name: "Device",
      icon: DeviceIcon,
      panel: DevicePanel,
      connection: ({instanceConfig}) => ({
        channel: `${instanceConfig.name}.info.connected`,
        label: "Device connection",
        endpoint: `${instanceConfig.parameters.host}:${instanceConfig.parameters.port}`,
      }),
    });
    registry.addResource({id: "reports", name: "Reports", type: "component", component: Reports});
    registry.addSchematicNode({
      id: "gauge",
      name: "Gauge",
      component: Gauge,
      dataDefaults: {label: "Gauge"},
      palette: {defaults: {width: 160, height: 80}},
    });
    registry.addSettingsPanel({id: "general", name: "Settings", component: Settings});
    registry.addPopupUi({
      id: "review",
      name: "Review detected hardware",
      component: HardwareReview,
      requestType: "HardwareCandidateV1",
      resultType: "HardwareReviewResultV1",
    });
  },
});
```

IDs passed to the registry are local. The host validates them and exposes them as `<plugin-id>.<local-id>`. Duplicate IDs in a category fail plugin loading instead of replacing another registration.

`connection` is optional. When supplied, the host uses the declared live channel for the module header and resource-navigation status indicator. Module types that omit it do not subscribe to a connection channel or render connection UI.

`addPopupUi` registers a named modal workflow. The corresponding engine plugin calls `requestInterfaceUi("review", payload, options)`; the engine qualifies that local ID as `my_plugin.review`. The component receives all merge-compatible pending `requests` plus `complete(requestId, result)` and `dismiss(requestId, result?)`. `requestType` and `resultType` name the contract, while optional `requestSchema` and `resultSchema` publish its JSON shape. This lets several detectors share one notification and modal without losing the per-request result returned to each backend caller. Use the built-in `dartwic.module-discovery` workflow when the standard module/channel/task discovery UI is appropriate instead of registering a custom renderer. Its Create action submits one engine-side provisioning transaction and returns the accepted plan plus its module/task receipt.

The runtime entry is deliberately small:

```js
import {registerPlugin} from "@dartwic/interface-sdk/runtime";
import plugin from "./plugin.jsx";

registerPlugin(plugin);
```

Build output is `ui/index.js`. The live registry supplies installed-plugin contribution counts; packages contain no generated contribution metadata.

Schematic node renderers and configuration UI are interface-owned. Place engine-readable palette JSON beneath `files/workspace/global_data/schematic_nodes/...`; installation mirrors it into the engine configuration root.

Public entrypoints include the main registry types, `assets`, `storage`, `tasks`, `resources`, `plugin-settings`, `module-configs`, `schematic-nodes`, `hooks`, `ui`, `utils`, `runtime`, `react`, and the Tailwind preset.

`createStorageClient(operation)` from `@dartwic/interface-sdk/storage` provides
named-root file references, JSON helpers and workspace/project settings overrides.
See the hand-written [Storage and Settings guide](../../docs/Website/docs/Plugins/Storage%20and%20Settings.md)
for location scopes, inheritance/reset examples, private module files and the 3D asset pattern.

`createWorkspaceAssetClient(operation)` from `@dartwic/interface-sdk/assets` reads and saves reusable text/JSON packages beneath `workspace/global_data/assets/<namespace>/<filename>`. Media and 3D nodes use this same store. Use your plugin ID as the namespace, and keep portable references in configuration. See [Workspace Assets](../../docs/Design/99%20-%20Development%20Guides/Workspace%20Assets.md) for interface and engine examples, binary packaging, access rules and legacy compatibility.

## Stable resource identities

Resource contribution IDs remain plugin-qualified, but a plugin can preserve an established storage and navigation identity with `resourceName`:

```jsx
registry.addResource({
  id: "editor",
  name: "Checklists",
  resourceName: "checklists",
  type: "directory",
  icon: ChecklistsIcon,
  component: ChecklistsEditor,
});
```

The contribution above is `checklists.editor`; its runtime, file, tab, link, and collaboration identity is `checklists`. Runtime names must be safe single path segments and cannot collide with core or other loaded resources.

Resource components receive the typed `ResourceComponentProps` contract. It includes initial reads, error/loading callbacks, live edits, presence, sync status, and `saveResourceContent(content, {silent: true})` for debounced autosaves that should not emit success toasts.

## Host Markdown and chips

Import the shared renderer from `@dartwic/interface-sdk/markdown`:

```jsx
import {MarkdownRenderer, defineMarkdownChip} from "@dartwic/interface-sdk/markdown";
```

`MarkdownRenderer` is host-owned and renders ordinary Markdown unless a specific instance receives chip definitions. A `defineMarkdownChip` descriptor supplies an ID, token parser, serializer, and React renderer; the interface host turns it into the private TipTap/ProseMirror extension. Channel drop behavior is similarly opt-in through `getChannelDropActions`.

Use `editorRef` for `getMarkdown`, `setMarkdown`, `applyRemoteEdits`, `focusHeading`, `getPresenceSnapshot`, and `hasFocus`. Plugin code must use `@dartwic/interface-sdk/react` and host SDK UI/Markdown abstractions. Do not bundle another React runtime or import TipTap/ProseMirror.
# Channel value formats

Register a numeric format in `register(registry)`:

```ts
registry.addValueFormat({
    id: "percent",
    name: "Percentage",
    format: value => `${value * 100}%`,
    toDraft: value => String(value * 100),
    parse: draft => Number(draft) / 100,
    placeholder: "Percent",
});
```

For a plugin with id `example`, set the channel Units to `format=example.percent`.
Values remain numeric. Channel Search, timeline controls and schematic command
popovers use the registered editor. A custom React `Editor` can instead receive
`value`, `onCommit(number)`, `onCancel`, and `disabled`; it must never write channels
directly. The host validates the number and preserves the caller's authority flow.
Formats are removed when the plugin is invalidated or unloaded, with raw numeric
fallback for unavailable formats. Built-in format ids cannot be replaced.

Use `FormattedValueInput` or `FormattedValueControl` from `@dartwic/interface-sdk/ui`
in task cards and plugin surfaces; pass `value`, `units`, and `onCommit(number)`.
The latter provides a discreet click-to-edit value with an editor popover (ghost
styling by default; `variant` can be overridden). Editors use a compact input/send
button group. Unix time uses a shadcn calendar plus local time input; mission time accepts `T-5h`, `T+2m 30s` and
`T-00:05:00`. Timeline telemetry stays read-only: use timeline clock operations
to change its anchor with a preview and explicit bucket decisions.
