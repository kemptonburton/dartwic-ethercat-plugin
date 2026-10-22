import {ensureBridge} from "./plugin-bridge.mjs";
import {getPluginPlatform, packagePluginRelease} from "./plugin-release.mjs";
import path from "node:path";
import {verifySdkLock} from "./plugin-sdk-lock.mjs";

import {
  getNpmCommand,
  copyDirectory,
  getPlatformBinaryName,
  getPluginSidePaths,
  packageJsonPath,
  pathExists,
  pluginManifestPath,
  pluginOutputRoot,
  readJson,
  removePath,
  repoRoot,
  runCommand,
  validatePluginManifest,
} from "./plugin-utils.mjs";

function getRequestedVersion(argv) {
  return argv.find((argument) => argument && !argument.startsWith("-")) ?? "";
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

async function preparePluginOutput(pluginId, hasEngine, hasInterface) {
  const sidePaths = getPluginSidePaths(pluginId);

  await removePath(sidePaths.engineReleaseDir);
  await removePath(sidePaths.engineDebugDir);
  await removePath(sidePaths.interfaceDir);

  const sourceFiles = path.resolve(repoRoot, "files");
  const outputFiles = path.resolve(pluginOutputRoot, "files");
  await removePath(outputFiles);
  if (await pathExists(sourceFiles)) {
    await copyDirectory(sourceFiles, outputFiles);
  }
}

async function configureEngine(preset) {
  await ensureBridge();
  const args = ["--preset", preset];
  if (process.env.DARTWIC_VCPKG_INSTALLED_DIR) {
    args.push("-DVCPKG_MANIFEST_INSTALL=OFF", `-DVCPKG_INSTALLED_DIR=${path.resolve(process.env.DARTWIC_VCPKG_INSTALLED_DIR)}`);
  }
  await runCommand("cmake", args);
}

async function buildEngine(pluginId) {
  process.stdout.write(`Building release engine plugin for ${pluginId}.\n`);
  if (process.platform === "win32") {
    await configureEngine("windows-clang-release");
    await runCommand("cmake", [
      "--build",
      "--preset",
      "build-windows-clang-release",
      "--target",
      "copy_engine_plugin",
    ]);
    return;
  }
  await configureEngine("linux-clang-release");
  await runCommand("cmake", ["--build", "--preset", "build-linux-clang-release", "--target", "copy_engine_plugin"]);
}

async function buildEngineDebug(pluginId) {
  process.stdout.write(`Building debug engine plugin for ${pluginId}.\n`);
  if (process.platform === "win32") {
    await configureEngine("windows-clang-debug");
    await runCommand("cmake", [
      "--build",
      "--preset",
      "build-windows-clang-debug",
      "--target",
      "copy_engine_plugin",
    ]);
    return;
  }
  await configureEngine("linux-clang-debug");
  await runCommand("cmake", ["--build", "--preset", "build-linux-clang-debug", "--target", "copy_engine_plugin"]);
}

async function buildInterface(pluginId) {
  process.stdout.write(`Building interface plugin for ${pluginId}.\n`);
  await runCommand(getNpmCommand(), ["run", "build"]);
}

async function verifyEngineOutput(pluginId) {
  const { engineReleaseDir } = getPluginSidePaths(pluginId);
  const manifestPath = path.resolve(engineReleaseDir, "plugin.json");
  const binaryPath = path.resolve(engineReleaseDir, "bin", getPlatformBinaryName(pluginId));

  if (!(await pathExists(manifestPath))) {
    throw new Error(`Expected packaged engine manifest was not produced: ${manifestPath}`);
  }

  if (!(await pathExists(binaryPath))) {
    throw new Error(`Expected packaged engine binary was not produced: ${binaryPath}`);
  }
}

async function verifyEngineDebugOutput(pluginId) {
  const { engineDebugDir } = getPluginSidePaths(pluginId);
  const manifestPath = path.resolve(engineDebugDir, "plugin.json");
  const binaryPath = path.resolve(engineDebugDir, "bin", getPlatformBinaryName(pluginId));

  if (!(await pathExists(manifestPath))) {
    throw new Error(`Expected packaged debug engine manifest was not produced: ${manifestPath}`);
  }

  if (!(await pathExists(binaryPath))) {
    throw new Error(`Expected packaged debug engine binary was not produced: ${binaryPath}`);
  }
}

async function verifyInterfaceOutput(pluginId) {
  const { interfaceDir } = getPluginSidePaths(pluginId);
  const manifestPath = path.resolve(interfaceDir, "plugin.json");
  const runtimeEntryPath = path.resolve(interfaceDir, "ui", "index.js");

  if (!(await pathExists(manifestPath))) {
    throw new Error(`Expected packaged interface manifest was not produced: ${manifestPath}`);
  }

  if (!(await pathExists(runtimeEntryPath))) {
    throw new Error(`Expected packaged interface runtime was not produced: ${runtimeEntryPath}`);
  }
}

async function main() {
  await verifySdkLock();
  const argv = process.argv.slice(2);
  if (argv.includes("--help")) { console.log("npm run package [-- version]: builds Release + Debug engine and Interface, then creates plugin-<platform>.zip with both native variants, or plugin.zip for Interface-only plugins, plus checksums."); return; }
  const requestedVersion = getRequestedVersion(argv);
  if (requestedVersion) {
    process.stdout.write(`Updating plugin metadata to version ${requestedVersion}.\n`);
    await runCommand(getNpmCommand(), ["version", requestedVersion, "--no-git-tag-version"]);
  }

  const {
    packageJson,
    pluginManifest,
    pluginId,
  } = await loadPluginManifest();
  const hasEngine = Boolean(pluginManifest.contains_engine_plugin);
  const hasInterface = Boolean(pluginManifest.contains_interface_plugin);
  if (hasEngine) getPluginPlatform();

  const configuredVcpkgRoot = String(process.env.VCPKG_ROOT ?? "").trim();
  const localVcpkgRoot = path.resolve(repoRoot, "vcpkg");
  const vcpkgRoot = configuredVcpkgRoot || (await pathExists(localVcpkgRoot) ? localVcpkgRoot : "");
  if (hasEngine && (!vcpkgRoot || !(await pathExists(path.resolve(vcpkgRoot, "scripts", "buildsystems", "vcpkg.cmake"))))) {
    throw new Error("Native packaging requires VCPKG_ROOT to point to your vcpkg checkout (or a vcpkg/ directory in this repository).");
  }
  if (hasEngine) process.env.VCPKG_ROOT = path.resolve(vcpkgRoot);

  await preparePluginOutput(pluginId, hasEngine, hasInterface);

  if (hasEngine) {
    await buildEngine(pluginId);
    await verifyEngineOutput(pluginId);
    await buildEngineDebug(pluginId);
    await verifyEngineDebugOutput(pluginId);
  }

  if (hasInterface) {
    await buildInterface(pluginId);
    await verifyInterfaceOutput(pluginId);
  }

  if (packageJson.scripts?.["verify:package"]) await runCommand(getNpmCommand(), ["run", "verify:package"]);

  await packagePluginRelease(repoRoot);


}

await main();
