import path from "node:path";
import fs from "node:fs/promises";
import {ensureBridge} from "./plugin-bridge.mjs";

import {
  copyDirectory,
  deploymentSettingsPath,
  getNpmCommand,
  getPluginSidePaths,
  packageJsonPath,
  pathExists,
  pluginManifestPath,
  readJson,
  removePath,
  runCommand,
  validatePluginManifest,
} from "./plugin-utils.mjs";

function getDeployMode(argv) {
  if (argv.includes("--engine-debug")) {
    return "engine-debug";
  }

  if (argv.includes("--debug")) {
    return "debug";
  }

  if (argv.includes("--interface")) {
    return "interface";
  }

  return "default";
}

async function loadPluginManifest() {
  const packageJson = await readJson(packageJsonPath);
  const pluginManifest = await readJson(pluginManifestPath);

  if (!packageJson || typeof packageJson !== "object") {
    throw new Error("package.json must contain an object.");
  }

  const validated = validatePluginManifest(pluginManifest);
  return {
    packageJson,
    pluginManifest,
    ...validated,
  };
}

async function loadDeploymentSettings() {
  const settings = await readJson(deploymentSettingsPath, {});
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new Error("deployment-settings.json must contain an object.");
  }

  return {
    engineDir: String(process.env.DARTWIC_ENGINE_DIR ?? settings.engine_dir ?? "").trim(),
    interfaceDir: String(process.env.DARTWIC_INTERFACE_DIR ?? settings.interface_dir ?? "").trim(),
  };
}

async function buildEngineRelease(pluginId) {
  process.stdout.write(`Building release engine plugin for ${pluginId}.\n`);
  await removePath(getPluginSidePaths(pluginId).engineReleaseDir);
  await ensureBridge();
  if (process.platform === "win32") {
    await runCommand("cmake", ["--preset", "windows-clang-release"]);
    await runCommand("cmake", [
      "--build",
      "--preset",
      "build-windows-clang-release",
      "--target",
      "copy_engine_plugin",
    ]);
    return;
  }
  await runCommand("cmake", [
    "-S",
    ".",
    "-B",
    "cmake-build-release",
    "-DCMAKE_BUILD_TYPE=Release",
  ]);
  await runCommand("cmake", [
    "--build",
    "cmake-build-release",
    "--config",
    "Release",
    "--target",
    "copy_engine_plugin",
  ]);
}

async function buildEngineDebug(pluginId) {
  process.stdout.write(`Building debug engine plugin for ${pluginId}.\n`);
  await removePath(getPluginSidePaths(pluginId).engineDebugDir);
  await ensureBridge();
  if (process.platform === "win32") {
    await runCommand("cmake", ["--preset", "windows-clang-debug"]);
    await runCommand("cmake", [
      "--build",
      "--preset",
      "build-windows-clang-debug",
      "--target",
      "copy_engine_plugin",
    ]);
    return;
  }
  await runCommand("cmake", [
    "-S",
    ".",
    "-B",
    "cmake-build-debug",
    "-DCMAKE_BUILD_TYPE=Debug",
  ]);
  await runCommand("cmake", [
    "--build",
    "cmake-build-debug",
    "--config",
    "Debug",
    "--target",
    "copy_engine_plugin",
  ]);
}

async function buildInterface(pluginId) {
  process.stdout.write(`Building interface plugin for ${pluginId}.\n`);
  await removePath(getPluginSidePaths(pluginId).interfaceDir);
  await runCommand(getNpmCommand(), ["run", "build"]);
}

async function requirePath(targetPath, label) {
  if (!(await pathExists(targetPath))) {
    throw new Error(`${label} was not produced: ${targetPath}`);
  }
}

async function deployEngineVariant(sourceDir, engineDir, pluginId, label) {
  if (!engineDir) {
    throw new Error(`Set DARTWIC_ENGINE_DIR or copy deployment-settings.example.json to deployment-settings.json and set engine_dir to deploy ${label}.`);
  }

  await requirePath(sourceDir, `${label} output`);
  const destinationDir = path.resolve(engineDir, "plugins", pluginId);
  await copyDirectory(sourceDir, destinationDir);
  process.stdout.write(`Deployed ${label} to ${destinationDir}.\n`);
}

async function deployInterface(sourceDir, interfaceDir, pluginId) {
  if (!interfaceDir) {
    throw new Error("Set DARTWIC_INTERFACE_DIR or copy deployment-settings.example.json to deployment-settings.json and set interface_dir to deploy the interface plugin.");
  }

  await requirePath(sourceDir, "interface plugin output");
  const destinationDir = path.resolve(interfaceDir, "plugins", pluginId);
  await copyDirectory(sourceDir, destinationDir);
  process.stdout.write(`Deployed interface plugin to ${destinationDir}.\n`);
}


async function validateDeploymentTargets(deployMode, hasEngine, hasInterface, engineDir, interfaceDir) {
  const deploysEngine = hasEngine && deployMode !== "interface";
  const deploysInterface = hasInterface && deployMode !== "engine-debug";

  if (deploysEngine && !engineDir) {
    throw new Error("Set DARTWIC_ENGINE_DIR or copy deployment-settings.example.json to deployment-settings.json and set engine_dir before deploying.");
  }
  if (deploysInterface && !interfaceDir) {
    throw new Error("Set DARTWIC_INTERFACE_DIR or copy deployment-settings.example.json to deployment-settings.json and set interface_dir before deploying.");
  }
}

async function main() {
  const deployMode = getDeployMode(process.argv.slice(2));
  const { pluginManifest, pluginId } = await loadPluginManifest();
  const { engineDir, interfaceDir } = await loadDeploymentSettings();
  const sidePaths = getPluginSidePaths(pluginId);
  const hasEngine = Boolean(pluginManifest.contains_engine_plugin);
  const hasInterface = Boolean(pluginManifest.contains_interface_plugin);

  await validateDeploymentTargets(deployMode, hasEngine, hasInterface, engineDir, interfaceDir);

  if (deployMode === "interface") {
    if (!hasInterface) {
      throw new Error(`Plugin '${pluginId}' does not declare an interface plugin.`);
    }

    await buildInterface(pluginId);
    await deployInterface(sidePaths.interfaceDir, interfaceDir, pluginId);
    return;
  }

  if (deployMode === "engine-debug") {
    if (!hasEngine) {
      throw new Error(`Plugin '${pluginId}' does not declare an engine plugin.`);
    }

    await buildEngineDebug(pluginId);
    await deployEngineVariant(sidePaths.engineDebugDir, engineDir, pluginId, "debug engine plugin");
    return;
  }

  if (deployMode === "debug") {
    if (hasEngine) {
      await buildEngineDebug(pluginId);
      await deployEngineVariant(sidePaths.engineDebugDir, engineDir, pluginId, "debug engine plugin");
    }

    if (hasInterface) {
      await buildInterface(pluginId);
      await deployInterface(sidePaths.interfaceDir, interfaceDir, pluginId);
    }


    return;
  }

  if (hasEngine) {
    await buildEngineRelease(pluginId);
    await deployEngineVariant(sidePaths.engineReleaseDir, engineDir, pluginId, "release engine plugin");
  }

  if (hasInterface) {
    await buildInterface(pluginId);
    await deployInterface(sidePaths.interfaceDir, interfaceDir, pluginId);
  }

}

await main();
