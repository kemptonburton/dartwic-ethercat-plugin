import React from "../sdk/react.ts";
import {Separator} from "../sdk/ui/general.ts";

export function EthercatTaskCard({task}) {
    const mappings = Array.isArray(task.arguments?.mappings) ? task.arguments.mappings : [];
    const commands = mappings.filter((mapping) => mapping?.direction === "channel_to_device").length;
    const telemetry = mappings.filter((mapping) => mapping?.direction === "device_to_channel").length;
    return <><Separator/><div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-md border bg-muted/40 px-3 py-2"><div className="text-muted-foreground">PDO MAPPINGS</div><div>{mappings.length}</div></div>
        <div className="rounded-md border bg-muted/40 px-3 py-2"><div className="text-muted-foreground">COMMANDS</div><div>{commands}</div></div>
        <div className="rounded-md border bg-muted/40 px-3 py-2"><div className="text-muted-foreground">TELEMETRY</div><div>{telemetry}</div></div>
    </div></>;
}
