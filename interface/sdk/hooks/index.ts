import { getHostApi } from "../internal/host.ts";

/** Returns the host's shared DARTWIC React context hook result. @dartwic-reference @category Hooks and Utilities */
export function useDartwic() {
    return getHostApi().useDartwic();
}

function callHostHook(name: string, args: unknown[] = []) {
    const hook = getHostApi().hooks?.[name];
    if (typeof hook !== "function") {
        throw new Error(`The interface host does not provide ${name}.`);
    }
    return hook(...args);
}

/** Current client identity, username, and administrator state.  @dartwic-reference @category Hooks and Utilities */
export function useClientInfo() {
    return callHostHook("useClientInfo");
}

/** Connected-client presentation and resource-presence helpers.  @dartwic-reference @category Hooks and Utilities */
export function useConnectedClients() {
    return callHostHook("useConnectedClients");
}

/** Controls the shared bottom context panel.  @dartwic-reference @category Hooks and Utilities */
export function useBottomContextPanel() {
    return callHostHook("useBottomContextPanel");
}

/** Reads the host's live channel values.  @dartwic-reference @category Hooks and Utilities */
export function useDartwicChannelValues(...args: unknown[]) {
    return callHostHook("useDartwicChannelValues", args);
}

/** Lists remote TEMPEST nodes, operations, and pins and calls peer commands. @dartwic-reference @category Hooks and Utilities */
export function useRemoteTempest() {
    return callHostHook("useRemoteTempest") as {
        listNodes(): Promise<Record<string, unknown>[]>;
        listOperations(node: string): Promise<Record<string, unknown>[]>;
        listPinnedCommands(node: string, peerId: string): Promise<Record<string, unknown>[]>;
        call(node: string, operation: string, args?: Record<string, unknown>): Promise<Record<string, unknown>>;
        callPinned(node: string, preset: string, overrides?: Record<string, unknown>): Promise<Record<string, unknown>>;
    };
}

/** Evaluate serialized configurable-input state through the host hook. @dartwic-reference @category Hooks and Utilities */
export function useConfigurableInput(data: Record<string, unknown>) {
    return callHostHook("useConfigurableInput", [data]);
}

/** Evaluate an if/else block using the host live-data hook. @dartwic-reference @category Hooks and Utilities */
export function useIfElseBlock(data: Record<string, unknown>) {
    return callHostHook("useIfElseBlock", [data]);
}

/** Register a handler for channel drops with optional host drop-target settings. @dartwic-reference @category Hooks and Utilities */
export function useChannelDropTarget(handler: (payload: unknown) => void, options?: Record<string, unknown>) {
    return callHostHook("useChannelDropTarget", [handler, options]);
}

/** Read status names for the supplied channel value paths. @dartwic-reference @category Hooks and Utilities */
export function useChannelStatusNames(channelValuePaths: string[]) {
    return callHostHook("useChannelStatusNames", [channelValuePaths]);
}

/** Opens resources through the host's docked-layout navigation.  @dartwic-reference @category Hooks and Utilities */
export function useResourceNavigation() {
    return callHostHook("useResourceNavigation");
}

/** Controls whether remote participants are shown for a resource.  @dartwic-reference @category Hooks and Utilities */
export function useResourceParticipantVisibility(resourceName: string, resourcePath: string) {
    return callHostHook("useResourceParticipantVisibility", [resourceName, resourcePath]);
}
