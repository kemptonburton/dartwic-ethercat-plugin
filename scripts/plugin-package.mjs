import path from "node:path";
import {verifySdkLock} from "./plugin-sdk-lock.mjs";
import {ensureBridge} from "./plugin-bridge.mjs";

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

function isDebugPackage(argv) {
  return argv.includes("--debug");
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

  if (hasEngine) {
    await removePath(sidePaths.engineReleaseDir);
    await removePath(sidePaths.engineDebugDir);
  } else {
    await removePath(sidePaths.engineReleaseDir);
    await removePath(sidePaths.engineDebugDir);
  }

  if (hasInterface) {
    await removePath(sidePaths.interfaceDir);
  } else {
    await removePath(sidePaths.interfaceDir);
  }

  const sourceFiles = path.resolve(repoRoot, "files");
  const outputFiles = path.resolve(pluginOutputRoot, "files");
  await removePath(outputFiles);
  if (await pathExists(sourceFiles)) {
    await copyDirectory(sourceFiles, outputFiles);
  }
}

async function buildEngine(pluginId) {
  process.stdout.write(`Building release engine plugin for ${pluginId}.\n`);
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
  await runCommand("cmake", ["--preset", "linux-clang-release"]);
  await runCommand("cmake", [
    "--build",
    "--preset",
    "build-linux-clang-release",
    "--target",
    "copy_engine_plugin",
  ]);
}

async function buildEngineDebug(pluginId) {
  process.stdout.write(`Building debug engine plugin for ${pluginId}.\n`);
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
  await runCommand("cmake", ["--preset", "linux-clang-debug"]);
  await runCommand("cmake", [
    "--build",
    "--preset",
    "build-linux-clang-debug",
    "--target",
    "copy_engine_plugin",
  ]);
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

async function createPluginArchive(debug) {
  const archiveName = debug ? "plugin-debug.zip" : "plugin.zip";
  const pluginZipPath = path.resolve(repoRoot, archiveName);
  await removePath(pluginZipPath);

  if (!(await pathExists(pluginOutputRoot))) {
    throw new Error(`Plugin output directory was not produced: ${pluginOutputRoot}`);
  }

  if (process.platform === "win32") {
    await runCommand("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `Compress-Archive -LiteralPath 'plugin' -DestinationPath '${archiveName}' -Force`,
    ]);
    return pluginZipPath;
  }

  await runCommand("zip", ["-qr", archiveName, "plugin"]);
  return pluginZipPath;
}

async function main() {
  await verifySdkLock();
  const argv = process.argv.slice(2);
  const debug = isDebugPackage(argv);
  const requestedVersion = getRequestedVersion(argv);
  if (requestedVersion) {
    process.stdout.write(`Updating plugin metadata to version ${requestedVersion}.\n`);
    await runCommand(getNpmCommand(), ["version", requestedVersion, "--no-git-tag-version"]);
  }

  const {
    pluginManifest,
    pluginId,
  } = await loadPluginManifest();
  const hasEngine = Boolean(pluginManifest.contains_engine_plugin);
  const hasInterface = Boolean(pluginManifest.contains_interface_plugin);

  const configuredVcpkgRoot = String(process.env.VCPKG_ROOT ?? "").trim();
  const localVcpkgRoot = path.resolve(repoRoot, "vcpkg");
  const vcpkgRoot = configuredVcpkgRoot || (await pathExists(localVcpkgRoot) ? localVcpkgRoot : "");
  if (!vcpkgRoot || !(await pathExists(path.resolve(vcpkgRoot, "scripts", "buildsystems", "vcpkg.cmake")))) {
    throw new Error("Native packaging requires VCPKG_ROOT to point to your vcpkg checkout (or a vcpkg/ directory in this repository).");
  }
  process.env.VCPKG_ROOT = path.resolve(vcpkgRoot);

  await preparePluginOutput(pluginId, hasEngine, hasInterface);

  if (hasEngine) {
    if (debug) {
      await buildEngineDebug(pluginId);
      await verifyEngineDebugOutput(pluginId);
    } else {
      await buildEngine(pluginId);
      await verifyEngineOutput(pluginId);
    }
  }

  if (hasInterface) {
    await buildInterface(pluginId);
    await verifyInterfaceOutput(pluginId);
  }

  await runCommand(getNpmCommand(), [
    "run",
    "verify:package",
    ...(debug ? ["--", "--debug"] : []),
  ]);

  const archivePath = await createPluginArchive(debug);

  process.stdout.write(`Packaged plugin archive at ${archivePath}.\n`);
}

await main();
