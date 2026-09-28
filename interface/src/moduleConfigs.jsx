import React from "../sdk/react.ts";
import {useModuleConfigBridge} from "../sdk/module-configs/index.ts";
import {Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "../sdk/ui/general.ts";
import {ManualRefreshButton, ModuleRuntimeOverview} from "../sdk/ui/dartwic.ts";

function unwrap(result) {
    if (result?.error) throw new Error(result?.payload?.error || "EtherCAT operation failed.");
    return result?.payload ?? result ?? [];
}

function mappingDetail(mapping) {
    const index = Number(mapping?.index);
    const subindex = Number(mapping?.subindex);
    const objectAddress = Number.isFinite(index)
        ? `0x${index.toString(16).padStart(4, "0")}:${Number.isFinite(subindex) ? subindex : 0}`
        : "PDO";
    const slave = Number.isFinite(Number(mapping?.slave_position)) ? `S${Number(mapping.slave_position)}` : "SLAVE";
    return `${slave} · ${objectAddress} · ${String(mapping?.data_type || "VALUE").toUpperCase()}`;
}

function resolveEthercatTaskChannels(task) {
    const mappings = Array.isArray(task?.arguments?.mappings) ? task.arguments.mappings : [];
    return mappings.flatMap((mapping) => {
        const channels = [{
            name: String(mapping?.channel ?? "").trim(),
            direction: mapping?.direction === "channel_to_device" ? "output" : "input",
            detail: mappingDetail(mapping),
        }];
        if (mapping?.direction === "channel_to_device") {
            channels.push({
                name: String(mapping?.readback_channel || `${String(mapping?.channel ?? "").trim()}_state`).trim(),
                direction: "input",
                detail: `STATE · ${mappingDetail(mapping)}`,
            });
        }
        return channels;
    }).filter((channel) => channel.name);
}

function ConnectionField({label, htmlFor, children}) {
    return <div className="min-w-0 space-y-1.5">
        <Label htmlFor={htmlFor} className="block text-[11px] text-muted-foreground">{label}</Label>
        {children}
    </div>;
}

function ConnectionFieldRow({label, children}) {
    return <div
        className="grid min-h-12 items-end gap-5 border-t border-border/70 px-3 py-3 last:border-b"
        style={{gridTemplateColumns: "minmax(140px, 0.45fr) minmax(0, 1.55fr)"}}
    >
        <div className="pb-2 text-xs text-muted-foreground">{label}</div>
        {children}
    </div>;
}

export function EthercatModuleConfig({instanceConfig, setInstanceConfig, save, operation, moduleEditor}) {
    const parameters = instanceConfig?.parameters || {};
    const [adapters, setAdapters] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState("");
    const [saved, setSaved] = React.useState(parameters);
    const saveRef = React.useRef(save);
    const parametersRef = React.useRef(parameters);
    saveRef.current = save;
    parametersRef.current = parameters;
    const isDirty = JSON.stringify(parameters) !== JSON.stringify(saved);

    React.useEffect(() => {
        setSaved(instanceConfig?.parameters || {});
        setError("");
    }, [instanceConfig?.name]);

    function update(key, value) {
        setInstanceConfig((current) => ({...current, parameters: {...(current?.parameters || {}), [key]: value}}));
    }

    const loadAdapters = React.useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const value = unwrap(await operation("ethercat.adapters", {}, 15000));
            setAdapters(Array.isArray(value) ? value : []);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
            setLoading(false);
        }
    }, [operation]);

    React.useEffect(() => { void loadAdapters(); }, [loadAdapters]);

    const handleSave = React.useCallback(async () => {
        setSaving(true);
        setError("");
        try {
            await saveRef.current();
            setSaved(parametersRef.current);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
            setSaving(false);
        }
    }, []);

    useModuleConfigBridge(moduleEditor, {
        isDirty,
        isSaving: saving,
        canSave: Boolean(parameters.adapter),
        errorMessage: error,
        saveLabel: "SAVE CONFIG",
        onSave: handleSave,
    });

    const adapterOptions = React.useMemo(() => {
        const options = adapters.filter((adapter) => adapter.kind === "hardware");
        if (parameters.adapter && !options.some((adapter) => adapter.id === parameters.adapter)) {
            return [...options, {id: parameters.adapter, name: `${parameters.adapter} (saved)`, kind: "hardware"}];
        }
        return options;
    }, [adapters, parameters.adapter]);

    return <div className="space-y-8">
        <div className="pb-2">
            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-xs font-medium text-muted-foreground">CONNECTION DETAILS</div>
                <ManualRefreshButton tooltip="REFRESH ADAPTERS" isRefreshing={loading} onClick={loadAdapters}/>
            </div>
            <div>
                <ConnectionFieldRow label="Network interface">
                    <div className="grid min-w-0 gap-3" style={{gridTemplateColumns: "minmax(240px, 1fr) minmax(150px, .35fr)"}}>
                        <ConnectionField label="Adapter" htmlFor="ethercat-adapter">
                            <Select value={parameters.adapter || ""} onValueChange={(value) => update("adapter", value)}>
                                <SelectTrigger id="ethercat-adapter"><SelectValue placeholder="SELECT ADAPTER"/></SelectTrigger>
                                <SelectContent>
                                    {adapterOptions.map((adapter) => <SelectItem key={adapter.id} value={adapter.id}>{adapter.name || adapter.id}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </ConnectionField>
                        <ConnectionField label="Frame receive timeout (µs)" htmlFor="ethercat-receive-timeout">
                            <Input
                                id="ethercat-receive-timeout"
                                type="number"
                                min="50"
                                step="50"
                                value={parameters.receive_timeout_us ?? 100000}
                                onChange={(event) => update("receive_timeout_us", event.target.value === "" ? "" : Number(event.target.value))}
                            />
                        </ConnectionField>
                    </div>
                </ConnectionFieldRow>
            </div>
            {!loading && adapters.length === 0
                ? <div className="px-3 pt-3 text-xs text-muted-foreground">NO ADAPTERS FOUND. WINDOWS REQUIRES NPCAP.</div>
                : null}
        </div>
        <ModuleRuntimeOverview
            instanceName={instanceConfig?.name || ""}
            taskTypeIds={["ethercat.cycle"]}
            resolveTaskChannels={resolveEthercatTaskChannels}
            emptyMessage="NO TASKS LINKED TO THIS MODULE"
            className="pt-2"
        />
    </div>;
}
