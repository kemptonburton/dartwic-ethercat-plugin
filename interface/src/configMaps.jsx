import React from '../sdk/react.ts';
import {defineConfigMap, createModuleConfigAdapter, createTaskConfigAdapter, ConfigMap} from '../sdk/config-maps/index.ts';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '../sdk/ui/general.ts';
import {ComboboxSearch, ManualRefreshButton} from '../sdk/ui/dartwic.ts';

function payload(result) {
    if (!result || result.error) throw new Error(result?.payload?.error || 'EtherCAT operation failed.');
    return result.payload;
}
function AdapterCell({draft, onCommit, context, disabled}) {
    const operation = React.useRef(context.operation); operation.current = context.operation;
    const [adapters, setAdapters] = React.useState([]), [busy, setBusy] = React.useState(false), [error, setError] = React.useState('');
    const generation = React.useRef(0);
    const refresh = React.useCallback(async () => {
        const token = ++generation.current; setBusy(true); setError('');
        try { const values = payload(await operation.current('ethercat.adapters', {}, 15000));
            if (token === generation.current) setAdapters(Array.isArray(values) ? values.filter(item => item.kind === 'hardware') : []);
        } catch (cause) { if (token === generation.current) setError(cause.message); }
        finally { if (token === generation.current) setBusy(false); }
    }, []);
    React.useEffect(() => { void refresh(); return () => { generation.current++; }; }, [refresh]);
    const options = adapters.some(item => item.id === draft) || !draft ? adapters : [...adapters, {id: draft, name: `${draft} (saved)`}];
    return <div className="flex min-w-0 items-center gap-1">
        <Select value={draft || ''} onValueChange={onCommit} disabled={disabled}>
            <SelectTrigger className="h-6 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 text-xs"><SelectValue placeholder="Select adapter"/></SelectTrigger>
            <SelectContent>{options.map(item => <SelectItem key={item.id} value={item.id}>{item.name || item.id}</SelectItem>)}</SelectContent>
        </Select>
        <ManualRefreshButton tooltip={error || 'Refresh adapters'} isRefreshing={busy} disabled={disabled} onClick={refresh}/>
        {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
    </div>;
}
let topology;
const topologyContext = () => topology ||= React.createContext(null);
function entryKey(row) { return `${row.direction}:${row.slave_position}:${row.pdo_index}:${row.index}:${row.subindex}:${row.bit_offset}`; }
function entryLabel(row) { return `N${row.slave_position} · 0x${Number(row.index).toString(16).padStart(4, '0')}:${row.subindex} · ${row.name || row.data_type || 'PDO'}`; }
function flatten(value) {
    return (value?.slaves || []).flatMap(slave => [
        ...(slave.outputs || []).map(entry => ({...entry, slave_position: slave.position, slave_name: slave.name, direction: 'channel_to_device'})),
        ...(slave.inputs || []).map(entry => ({...entry, slave_position: slave.position, slave_name: slave.name, direction: 'device_to_channel'})),
    ]);
}
function TopologyProvider({operation, children}) {
    const Topology = topologyContext();
    const operationRef = React.useRef(operation); operationRef.current = operation;
    const [cache, setCache] = React.useState({});
    const pending = React.useRef(new Map()), active = React.useRef(true);
    React.useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
    const scan = React.useCallback((name, scopedOperation) => {
        if (pending.current.has(name)) return pending.current.get(name);
        const request = (async () => {
            const entries = flatten(payload(await (scopedOperation || operationRef.current)('ethercat.scan', {module_instance_name: name}, 30000)));
            if (active.current) setCache(previous => ({...previous, [name]: entries}));
            return entries;
        })().finally(() => pending.current.delete(name));
        pending.current.set(name, request); return request;
    }, []);
    return <Topology.Provider value={{cache, scan}}>{children}</Topology.Provider>;
}
function PdoCell({path, row = {}, document, onDraftAt, disabled, context}) {
    const shared = React.useContext(topologyContext());
    const [entries, setEntries] = React.useState([]), [busy, setBusy] = React.useState(false), [error, setError] = React.useState('');
    const name = document.arguments?.module_instance_name;
    const generation = React.useRef(0);
    React.useEffect(() => { generation.current++; setEntries([]); setError(''); setBusy(false); return () => { generation.current++; }; }, [name]);
    const scan = async () => {
        const token = ++generation.current; setBusy(true); setError('');
        try { const values = shared ? await shared.scan(name, context.operation) : flatten(payload(await context.operation('ethercat.scan', {module_instance_name: name}, 30000)));
            if (token === generation.current) setEntries(values);
        } catch (cause) { if (token === generation.current) setError(cause.message); }
        finally { if (token === generation.current) setBusy(false); }
    };
    const available = (shared?.cache[name] || entries).filter(entry => entry.direction === row.direction);
    const selected = row.entry_key || (row.bit_length ? entryKey(row) : '');
    const options = available.map(entry => ({value: entryKey(entry), label: entryLabel(entry)}));
    if (selected && !options.some(item => item.value === selected)) options.push({value: selected, label: `${entryLabel(row)} (saved)`});
    const base = path.slice(0, path.lastIndexOf(path.startsWith('new:') ? ':' : '.') + 1);
    return <div className="flex min-w-0 items-center gap-1">
        <ComboboxSearch items={options} initialValue={selected} placeholder="Scan and select PDO entry" unSelectable={false}
            commandSearchPlaceholder="Search PDO entries…" popoverContentClassName="w-[min(640px,calc(100vw-24px))]"
            disabled={disabled} className="h-6 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 text-xs normal-case"
            onSelect={key => {
                const entry = available.find(item => entryKey(item) === key); if (!entry || disabled) return;
                for (const field of ['slave_position', 'pdo_index', 'index', 'subindex', 'bit_offset', 'bit_length', 'data_type', 'name', 'slave_name'])
                    if (entry[field] !== undefined) onDraftAt(`${base}${field}`, entry[field]);
                onDraftAt(`${base}entry_key`, key);
            }}/>
        <ManualRefreshButton tooltip={error || 'Scan selected master'} isRefreshing={busy} disabled={disabled || !name} onClick={scan}/>
        {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
    </div>;
}
function DirectionCell({path, row = {}, onDraftAt, disabled}) {
    const base = path.slice(0, path.lastIndexOf(path.startsWith('new:') ? ':' : '.') + 1);
    return <Select value={row.direction || 'channel_to_device'} disabled={disabled} onValueChange={direction => {
        if (disabled || direction === row.direction) return;
        onDraftAt(path, direction); onDraftAt(`${base}entry_key`, '');
        for (const key of ['slave_position', 'index', 'subindex', 'bit_offset', 'bit_length']) onDraftAt(`${base}${key}`, '');
        onDraftAt(`${base}readback_channel`, direction === 'channel_to_device' && row.channel ? `${row.channel}_state` : '');
    }}>
        <SelectTrigger className="h-6 rounded-none border-0 bg-transparent px-0 text-xs"><SelectValue/></SelectTrigger>
        <SelectContent><SelectItem value="channel_to_device">Command</SelectItem><SelectItem value="device_to_channel">Telemetry</SelectItem></SelectContent>
    </Select>;
}
export const moduleMap = defineConfigMap({...createModuleConfigAdapter(), title: 'EtherCAT master', groups: [
    {id: 'connection', label: 'Connection', fields: [
        {path: 'parameters.adapter', label: 'Network adapter', type: 'text', required: true, render: props => <AdapterCell {...props}/>},
        {path: 'parameters.receive_timeout_us', label: 'Frame receive timeout (µs)', type: 'number', integer: true, min: 50, defaultValue: 10000},
    ]},
]});
export const cycleMap = defineConfigMap({...createTaskConfigAdapter(), title: 'EtherCAT cyclic I/O', groups: [
    {id: 'configuration', label: 'Task configuration', fields: [
        {path: 'arguments.module_instance_name', label: 'Module connection', type: 'module', pluginId: 'ethercat', moduleTypeIds: ['master'], required: true},
    ]}, {id: 'bindings', label: 'PDO mappings', tables: [{path: 'arguments.mappings', label: 'PDO mappings', createRow: () => ({direction: 'channel_to_device', scale: 1, offset: 0}), columns: [
        {path: 'direction', label: 'Direction', type: 'select', required: true, options: [{value: 'channel_to_device', label: 'Command'}, {value: 'device_to_channel', label: 'Telemetry'}],
            render: props => <DirectionCell {...props}/>},
        {path: 'entry_key', label: 'PDO entry', type: 'text', render: props => <PdoCell {...props}/>},
        {path: 'channel', label: 'Channel', type: 'channel', required: true, channelMode: (_document, row) => row?.direction === 'channel_to_device' ? 'read' : 'write'},
        {path: 'readback_channel', label: 'Output state channel', type: 'channel', channelMode: 'write', placeholder: 'Defaults to <command>_state',
            defaultValue: (_document, row) => row?.direction === 'channel_to_device' && row.channel ? `${row.channel}_state` : undefined},
        {path: 'scale', label: 'Scale', type: 'number', defaultValue: 1}, {path: 'offset', label: 'Offset', type: 'number', defaultValue: 0},
        ...['slave_position', 'index', 'subindex', 'bit_offset', 'bit_length'].map(path => ({path, label: path.replaceAll('_', ' '), type: 'number', integer: true, required: true, min: 0, hidden: true})),
        ...['pdo_index', 'data_type', 'name', 'slave_name'].map(path => ({path, label: path.replaceAll('_', ' '), hidden: true})),
    ]}]},
], validate(document) {
    const rows = document.arguments?.mappings || [];
    if (!rows.length) return 'Add at least one PDO mapping.';
    for (const row of rows) {
        if (!row.bit_length || row.bit_length > 64) return 'Select a PDO entry with a bit length from 1 to 64.';
        if (row.direction === 'channel_to_device' && (row.readback_channel === row.channel || row.readback_channel === ''))
            return 'Use a different nonempty output-state channel, or leave it unset for the default.';
    }
    return '';
}});
export function EthercatConfigLayout(props) {
    return <TopologyProvider operation={props.operation}>
        <ConfigMap groupIds={['configuration']}/>
        <p className="py-3 text-xs text-muted-foreground">Scan the selected master from a PDO cell, then choose an entry. Saved entries remain available while offline.</p>
        <ConfigMap groupIds={['bindings']}/>
    </TopologyProvider>;
}
