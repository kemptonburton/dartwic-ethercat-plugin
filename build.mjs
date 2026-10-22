import path from "node:path";
import {fileURLToPath} from "node:url";
import {cp, mkdir, readFile} from "node:fs/promises";
import {build} from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceManifestPath = path.resolve(__dirname, "plugin.json");
const sourceManifest = JSON.parse(await readFile(sourceManifestPath, "utf8"));
const pluginId = String(sourceManifest.id ?? "").trim();
const minEngineVersion = String(sourceManifest.minEngineVersion ?? "").trim();
const minInterfaceVersion = String(sourceManifest.minInterfaceVersion ?? "").trim();
const releasePluginDir = path.resolve(__dirname, "plugin", "interface", pluginId);
const pluginManifestPath = path.resolve(releasePluginDir, "plugin.json");
const outputPath = path.resolve(releasePluginDir, "ui", "index.js");

if (!pluginId || !minEngineVersion || !minInterfaceVersion || sourceManifest.contains_interface_plugin !== true) {
    throw new Error("plugin.json must include id, minEngineVersion, minInterfaceVersion, and contains_interface_plugin=true.");
}

await mkdir(path.dirname(outputPath), {recursive: true});

await build({
    entryPoints: [path.resolve(__dirname, "interface", "src", "runtime-entry.jsx")],
    outfile: outputPath,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2022"],
    jsx: "transform",
    minify: true,
    legalComments: "none",
});

await cp(sourceManifestPath, pluginManifestPath, {force: true});
await cp(path.join(__dirname, "assets"), path.join(releasePluginDir, "assets"), {recursive: true, force: true});

console.log(`Built EtherCAT interface plugin from interface/src for ${pluginId}.`);
console.log(`- ${releasePluginDir}`);
