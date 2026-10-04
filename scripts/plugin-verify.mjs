import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

import {verifySdkLock} from "./plugin-sdk-lock.mjs";
import {
  getPluginSidePaths,
  packageJsonPath,
  pathExists,
  pluginManifestPath,
  readJson,
  validatePluginManifest,
} from "./plugin-utils.mjs";

async function materializeInterfacePlugin(pluginId, runtimePath) {
  const sandbox = {window: {}, console};
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(await fs.readFile(runtimePath, "utf8"), sandbox, {filename: runtimePath});
  const registration = sandbox.window.__dartwicPluginRegistry__?.[pluginId];
  if (!registration || typeof registration.createPlugin !== "function") {
    throw new Error(`Packaged interface runtime did not register '${pluginId}'.`);
  }
  return registration.createPlugin({React: {}});
}

async function main() {
  await verifySdkLock();
  const packageJson = await readJson(packageJsonPath);
  const scripts = packageJson?.scripts ?? {};
  for (const [name, command] of Object.entries(scripts)) {
    if (typeof command !== "string") {
      throw new Error(`package.json script '${name}' must be a string.`);
    }
    if (name === "sync-sdk" || command.includes("../") || command.includes("..\\") || command.includes("releases/scripts")) {
      throw new Error(`package.json script '${name}' depends on files outside this standalone repository.`);
    }
  }
  const manifest = await readJson(pluginManifestPath);
  const {pluginId} = validatePluginManifest(manifest);
  if (process.argv.includes("--source-only")) {
    const requiredSources = [
      path.resolve("CMakeLists.txt"),
      path.resolve("engine", "src", "ethercat_plugin.cpp"),
      path.resolve("bridge", "src", "dartwic_ethercat_bridge.cpp"),
      path.resolve("interface", "src", "runtime-entry.jsx"),
    ];
    const missing = [];
    for (const sourcePath of requiredSources) if (!(await pathExists(sourcePath))) missing.push(sourcePath);
    if (missing.length) throw new Error(`Required plugin source files are missing: ${missing.join(", ")}`);
    process.stdout.write(`Verified standalone plugin source '${pluginId}' and its bundled SDK snapshots.\n`);
    return;
  }
  const {engineReleaseDir, engineDebugDir, interfaceDir} = getPluginSidePaths(pluginId);
  const engineDir = process.argv.includes("--debug") ? engineDebugDir : engineReleaseDir;

  if (manifest.contains_engine_plugin) {
    validatePluginManifest(await readJson(path.resolve(engineDir, "plugin.json")));
    const bridgeName = process.platform === "win32" ? "dartwic_ethercat_bridge.dll"
      : process.platform === "darwin" ? "libdartwic_ethercat_bridge.dylib"
      : "libdartwic_ethercat_bridge.so";
    const bridgePath = path.resolve(engineDir, "bin", bridgeName);
    const bridge = await fs.readFile(bridgePath);
    for (const message of ["Opening nominal interface:", "Opening redundant interface:"]) {
      if (bridge.includes(Buffer.from(message))) {
        throw new Error(`Packaged bridge still contains routine adapter-open logging. Run npm run build:bridge and rebuild the engine plugin: ${bridgePath}`);
      }
    }
  }

  if (manifest.contains_interface_plugin) {
    const runtime = await materializeInterfacePlugin(pluginId, path.resolve(interfaceDir, "ui", "index.js"));
    if (!runtime?.contributions?.interface || !runtime?.moduleUis?.[`${pluginId}.master`]) {
      throw new Error("Packaged interface runtime did not materialize the expected live registry.");
    }
  }

  process.stdout.write(`Verified packaged plugin '${pluginId}' and its live interface registry.\n`);
}

await main();
