import test from "node:test";
import assert from "node:assert/strict";
import {setHostApi} from "../internal/host.ts";
import {createNotificationClient} from "./index.ts";
import type {InterfacePluginHostApi} from "../types/index.ts";

test("older hosts report the missing notification capability explicitly", () => {
    setHostApi({} as InterfacePluginHostApi);
    assert.throws(() => createNotificationClient("plugin"), /does not support local notifications/);
});
test("notification clients retain source identity and host lifecycle services", () => {
    let source = "", removed = "";
    const client = {upsert() {}, remove(id: string) {removed = id;}, reportIssue() {}, clearIssue() {}, clear() {}};
    setHostApi({notifications: {createClient(id: string) {source = id; return client;}}} as unknown as InterfacePluginHostApi);
    assert.equal(createNotificationClient("test-plugin"), client);
    assert.equal(source, "test-plugin");
    createNotificationClient("test-plugin").remove("connection");
    assert.equal(removed, "connection");
});
