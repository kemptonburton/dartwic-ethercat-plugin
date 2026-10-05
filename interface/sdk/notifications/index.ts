import {getHostApi} from "../internal/host.ts";

/** Local notification severity. Actions are independent and appear in ACTIONS for any severity. @dartwic-reference @category Notifications */
export type NotificationSeverity = "message" | "warning" | "error";

/** Explicit settings destination; nestedTab selects a page's internal tab. @dartwic-reference @category Notifications */
export interface SettingsDestination {
    section?: "options";
    tab: string;
    nestedTab?: string;
    pluginName?: string;
}

/** Live local notification. Repeated evidence updates preserve read/mute state; escalation requests attention. @dartwic-reference @category Notifications */
export interface LocalNotification {
    /** Stable id local to this client source. The host qualifies it with the source. */
    id: string;
    severity?: NotificationSeverity;
    title: string;
    description?: string;
    /** Live handlers are never serialized. Re-upsert after loading the plugin. */
    actions?: Array<{id: string; label: string; handler(): void | Promise<void>}>;
    silenceable?: boolean;
    active?: boolean;
}

/** Explicitly owned warning/error. Reading or muting its notification does not resolve its settings badges. @dartwic-reference @category Notifications */
export interface SettingsIssue {
    id: string;
    severity: "warning" | "error";
    title: string;
    description: string;
    location: SettingsDestination;
    /** false for inline field validation: badges without notification spam. */
    notify?: boolean;
}

/** Source-isolated local services. Clear issues on recovery, discarded validation, or source removal.
 * No methods publish engine ARGUS events or RAPID channels. @dartwic-reference @category Notifications
 */
export interface LocalNotificationClient {
    upsert(notification: LocalNotification): void;
    remove(id: string): void;
    reportIssue(issue: SettingsIssue): void;
    clearIssue(id: string): void;
    /** Remove this source's notifications and issues when unloading it. */
    clear(): void;
}

/** Create a source-qualified notification and settings-issue client. Use the plugin id as source;
 * stable local ids deduplicate updates. Clear on recovery and call clear() when the source is removed.
 * Requires a host exposing notifications; older hosts report an explicit capability error.
 * @dartwic-reference @category Notifications
 */
export function createNotificationClient(source: string): LocalNotificationClient {
    const notifications = getHostApi().notifications;
    if (!notifications) throw new Error("This interface host does not support local notifications.");
    return notifications.createClient(source);
}
