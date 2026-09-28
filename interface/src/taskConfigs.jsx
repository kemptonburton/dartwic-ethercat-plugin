import React from "../sdk/react.ts";
import {useTaskConfigBridge} from "../sdk/tasks/index.ts";
import {Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "../sdk/ui/general.ts";
import {ChannelComboBox, ComboboxSearch, convertChannelReferenceToChannelName, ManualRefreshButton, TaskBindingTable} from "../sdk/ui/dartwic.ts";

function unwrap(result) {
    if (result?.error) throw new Error(result?.payload?.error || "EtherCAT operation failed.");
    return result?.payload ?? result;
}
function flattenEntries(topology) {
    const entries = [];
    for (const slave of topology?.slaves || []) {
        for (const entry of slave.outputs || []) entries.push({...entry, slave_position: slave.position, slave_name: slave.name, direction: "channel_to_device"});
        for (const entry of slave.inputs || []) entries.push({...entry, slave_position: slave.position, slave_name: slave.name, direction: "device_to_channel"});
    }
    return entries;
}
function entryKey(entry) { return `${entry.direction}:${entry.slave_position}:${entry.pdo_index}:${entry.index}:${entry.subindex}:${entry.bit_offset}`; }
function labelFor(entry) {
    const object = `0x${Number(entry.index).toString(16).padStart(4, "0")}:${entry.subindex}`;
    return `N${entry.slave_position} · ${object} · ${entry.name} · ${entry.data_type}`;
}
function defaultReadbackChannel(channel) {
    const value = String(channel || "").trim();
    if (!value) return "";
    return `${value}_state`;
}
function PdoEntrySearch({mapping, entries, onChange}) {
    const selected = entries.find((entry) => entryKey(entry) === mapping.entry_key);
    const availableEntries = entries.filter((entry) => entry.direction === mapping.direction);
    const options = availableEntries.map((entry) => ({value: entryKey(entry), label: labelFor(entry)}));
    return <ComboboxSearch items={options} initialValue={mapping.entry_key || ""}
        overrideValue={selected ? labelFor(selected) : undefined} placeholder="SELECT PDO ENTRY"
        commandSearchPlaceholder="SEARCH PDO ENTRIES..." commandSearchEmptyPlaceholder="NO PDO ENTRY FOUND"
        popoverContentClassName="w-[min(640px,calc(100vw-24px))]" unSelectable={false}
        className="h-8 w-full rounded-none border-0 bg-transparent px-0 text-xs normal-case shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        onSelect={(key) => {
            const entry = availableEntries.find((candidate) => entryKey(candidate) === key);
            if (entry) onChange({...entry, entry_key: key, channel: mapping.channel || "",
                readback_channel: entry.direction === "channel_to_device"
                    ? mapping.readback_channel || defaultReadbackChannel(mapping.channel)
                    : "",
                scale: mapping.scale ?? 1, offset: mapping.offset ?? 0});
        }}/>;
}
export function EthercatTaskConfig({task, operation, onSaved, onClose, taskEditor}) {
    const [instance, setInstance] = React.useState(task.arguments?.module_instance_name || "");
    const [mappings, setMappings] = React.useState(() => (task.arguments?.mappings || []).map((mapping, index) => ({
        ...mapping,
        readback_channel: mapping.direction === "channel_to_device"
            ? mapping.readback_channel || defaultReadbackChannel(mapping.channel)
            : "",
        entry_key: mapping.entry_key || entryKey(mapping),
        row_key: `saved-${index}`,
    })));
    const [topology, setTopology] = React.useState(null);
    const [scanning, setScanning] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState("");
    const nextRow = React.useRef(0);
    const initialScanStarted = React.useRef(false);
    const entries = React.useMemo(() => {
        const merged = flattenEntries(topology);
        const knownKeys = new Set(merged.map(entryKey));
        for (const mapping of mappings) {
            if (!mapping.entry_key || knownKeys.has(mapping.entry_key)) continue;
            merged.push(mapping);
            knownKeys.add(mapping.entry_key);
        }
        return merged;
    }, [topology, mappings]);
    const payload = React.useMemo(() => ({...(task.arguments || {}), module_instance_name: instance,
        mappings: mappings.filter((mapping) => mapping.entry_key && mapping.channel &&
            (mapping.direction !== "channel_to_device" || mapping.readback_channel))
            .map(({row_key, ...mapping}) => mapping)}), [task.arguments, instance, mappings]);
    const initial = React.useMemo(() => ({...(task.arguments || {}), module_instance_name: task.arguments?.module_instance_name || "", mappings: task.arguments?.mappings || []}), [task]);
    const dirty = JSON.stringify(payload) !== JSON.stringify(initial);
    const complete = mappings.length > 0 && payload.mappings.length === mappings.length;
    const moduleConnection = React.useMemo(() => ({
        pluginId: "ethercat",
        moduleTypeIds: ["master"],
        value: instance,
        onValueChange: (value) => {
            if (value !== instance) setMappings([]);
            setInstance(value);
            setTopology(null);
        },
        placeholder: "SELECT ONE ETHERCAT MASTER",
        description: "One cyclic task may own an EtherCAT master while running.",
        showConnectionStatus: true,
    }), [instance]);
    const scan = React.useCallback(async () => {
        if (!instance) return setError("SELECT AN ETHERCAT MASTER FIRST.");
        setScanning(true); setError("");
        try { setTopology(unwrap(await operation("ethercat.scan", {module_instance_name: instance}, 30000))); }
        catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
        finally { setScanning(false); }
    }, [instance, operation]);
    React.useEffect(() => {
        if (initialScanStarted.current || !instance || mappings.length === 0) return;
        initialScanStarted.current = true;
        void scan();
    }, [instance, mappings.length, scan]);
    async function saveTask() {
        if (!instance) return setError("SELECT AN ETHERCAT MASTER.");
        if (payload.mappings.length === 0) return setError("ADD AT LEAST ONE COMPLETE PDO MAPPING.");
        setSaving(true); setError("");
        try {
            const result = await operation("dartwic/create-task", {portal_name: task.portal, task_name: task.name, task_type: task.task_type, arguments: payload}, 30000);
            if (result?.error) return setError(result?.payload?.error || "FAILED TO SAVE TASK.");
            await onSaved?.(); await onClose?.();
        } finally { setSaving(false); }
    }
    useTaskConfigBridge(taskEditor, {isDirty: dirty, isSaving: saving, canSave: Boolean(instance) && complete, errorMessage: error,
        saveLabel: "SAVE", cancelLabel: "CANCEL", onSave: saveTask, onCancel: onClose, moduleConnection});
    const tableControlClass = "h-8 min-h-0 w-full rounded-none border-0 bg-transparent px-0 py-0 text-xs normal-case shadow-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0";
    const columns = [
        {
            key: "direction", label: "DIRECTION", width: "9rem",
            render: (mapping, _index, update) => <Select value={mapping.direction}
                onValueChange={(direction) => update({row_key: mapping.row_key, direction, entry_key: "",
                    channel: mapping.channel || "",
                    readback_channel: direction === "channel_to_device"
                        ? mapping.readback_channel || defaultReadbackChannel(mapping.channel)
                        : "",
                    scale: 1, offset: 0})}>
                <SelectTrigger className={`${tableControlClass} uppercase`}><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="channel_to_device">COMMAND</SelectItem>
                    <SelectItem value="device_to_channel">TELEMETRY</SelectItem>
                </SelectContent>
            </Select>,
        },
        {
            key: "entry_key", label: "PDO ENTRY", width: "minmax(24rem,2fr)",
            render: (mapping, _index, update) => <PdoEntrySearch mapping={mapping} entries={entries} onChange={update}/>,
        },
        {
            key: "channel", label: "CHANNEL", width: "minmax(14rem,1fr)",
            render: (mapping, _index, update) => <ChannelComboBox key={mapping.channel || mapping.row_key}
                mode={mapping.direction === "channel_to_device" ? "read" : "write"} showFieldSelector={false}
                initialValue={mapping.channel || ""} placeholder="SELECT CHANNEL"
                onSelect={(value) => {
                    const channel = convertChannelReferenceToChannelName(value);
                    update({...mapping, channel, readback_channel: mapping.direction === "channel_to_device"
                        ? mapping.readback_channel || defaultReadbackChannel(channel)
                        : ""});
                }}
                className="w-full" channelComboboxClassName={tableControlClass}/>,
        },
        {
            key: "readback_channel", label: "OUTPUT STATE", width: "minmax(14rem,1fr)",
            render: (mapping, _index, update) => mapping.direction === "channel_to_device" ? (
                <ChannelComboBox key={mapping.readback_channel || mapping.row_key}
                    mode="write" showFieldSelector={false}
                    initialValue={mapping.readback_channel || ""}
                    placeholder="SELECT STATE CHANNEL"
                    onSelect={(value) => update({...mapping,
                        readback_channel: convertChannelReferenceToChannelName(value)})}
                    className="w-full" channelComboboxClassName={tableControlClass}/>
            ) : <span className="text-xs text-muted-foreground">—</span>,
        },
    ];
    return <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-4">
            <div><Label>BUS TOPOLOGY</Label><div className="mt-1 text-xs normal-case text-muted-foreground">
                {topology ? `${entries.length} PDO entries discovered.` : "Scan the selected master before adding mappings."}
            </div></div>
            <ManualRefreshButton
                tooltip="SCAN BUS"
                isRefreshing={scanning}
                disabled={!instance}
                onClick={scan}
            />
        </div>
        <TaskBindingTable title="PDO MAPPINGS" bindings={mappings} onBindingsChange={setMappings}
            bindingTypes={[]} columns={columns} addLabel="ADD MAPPING" addDisabled={!topology} minTableWidth="72rem"
            createBinding={() => ({row_key: `new-${nextRow.current++}`, direction: "channel_to_device", entry_key: "", channel: "", readback_channel: "", scale: 1, offset: 0})}/>
    </div>;
}
