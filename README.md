# DARTWIC EtherCAT Plugin

High-speed cyclic EtherCAT I/O for DARTWIC 2.0. The plugin runs one synchronous, full-duplex process-data exchange per periodic task tick and is designed for a 1 ms (1 kHz) task period.

The repository is standalone and does not contain or require the private DARTWIC source tree. Versioned Engine and Interface SDK snapshots are bundled for plugin development.

## Architecture

The runtime is intentionally split at a C ABI boundary:

```text
DARTWIC periodic task (ClangCL / Clang)
  ├─ read prepared fixed command handles
  ├─ encode the complete output process image
  ├─ call one synchronous C bridge exchange
  ├─ decode the complete input process image
  └─ publish prepared fixed telemetry handles
                    │
                    ▼
dartwic_ethercat_bridge.dll / .so (GCC or MinGW GCC)
                    │
                    ▼
             KickCAT master + NIC
```

No C++ objects cross the compiler boundary. The public bridge interface is `engine/include/dartwic_ethercat_bridge.h`, and `DW_EC_BRIDGE_ABI_VERSION` protects against incompatible binaries.

One `ethercat.cycle` task exclusively owns one `ethercat.master` module while running. Reads and writes occur in the same EtherCAT frame cycle. There are no per-channel network operations, background command queues, or change-detection delays in the hot path.

Configuration retains fixed channel and diagnostic handles, PDO mappings, and
numeric buffers. At task start, an already connected process image is sized and
validated before cyclic exchange. A later connection or changed topology can
still resize the image on its first active tick. Each ordinary tick queries and
publishes the prepared handles and makes one synchronous bridge exchange.
Bridge/NIC latency, module mutex contention, and host scheduling remain part of
the deadline budget; the 1 ms setting is a target, not a measured guarantee.
Cycle failures publish the failure count and an ARGUS error with a 10-second
firing separation; local admission is limited to one report per 2 seconds.

## Configuration

The engine automatically scans every Npcap-visible adapter that is not already assigned to an EtherCAT Master module. When a slave chain responds, DARTWIC opens the standard device-found notification with:

- one suggested EtherCAT Master module for the adapter;
- the discovered slave identity and process-image topology;
- one suggested RAPID channel for every discovered input/output PDO entry; and
- an optional EtherCAT Cyclic I/O task containing the generated PDO mappings.

Discovery runs asynchronously, so an unavailable adapter cannot block engine or Settings startup. Its defaults are stored in `plugin.json` under `device_discovery`. After a bus has been added, that adapter is excluded from discovery so the scanner cannot contend with its configured master.

1. Create an **EtherCAT Master** module.
2. Select the dedicated physical EtherCAT adapter from the dropdown.
3. Create an **EtherCAT Cyclic I/O** periodic task and set its period to `1 ms` for 1 kHz operation.
4. Select the master and click **Scan Bus**.
5. Add mappings using the discovered slave/PDO dropdown, then select the corresponding RAPID channel.

The first release uses the PDO layout already exposed by each slave. Dynamic PDO reassignment is deliberately out of scope. Stopping a task stops cyclic exchange; it does not overwrite the last process-output values with an assumed safe state.

## Build the DARTWIC plugin

Requirements: Node.js 20+, CMake 3.23+, a vcpkg checkout, and the same supported compiler used by DARTWIC (ClangCL on Windows or Clang on Linux).

```shell
npm ci
npm run build:interface
npm run build:bridge
cmake --preset windows-clang-release
cmake --build --preset build-windows-clang-release --target copy_engine_plugin
```

Set `VCPKG_ROOT` before using the presets. On Linux, use `linux-clang-release` and `build-linux-clang-release`.

`npm run package` calls those native presets on Linux, builds the Interface side, and writes the current platform ZIP with both native configurations from a standalone checkout. Verify the KickCAT bridge's dynamic dependencies and NIC access on the target Linux host before controlling a slave chain.

## Build the KickCAT C bridge

KickCAT is fetched from [`leducp/KickCAT`](https://github.com/leducp/KickCAT) and pinned to commit `f10386d54f734d388a405b4dae506801e35c238b` (`v2.6-rc3`). The normal package and deploy commands build the bridge automatically, so no bridge override path is required. To build only the bridge, run:

```shell
npm run build:bridge
```

The canonical output is `build/bridge-windows/dartwic_ethercat_bridge.dll` on Windows and `build/bridge/libdartwic_ethercat_bridge.so` on Linux.

Windows requires the MSYS2 UCRT64 GCC, CMake, Ninja, and Python packages. The script creates an isolated Conan environment and obtains the Npcap development SDK automatically. Set `MSYS2_ROOT` only when MSYS2 is installed somewhere other than `C:\msys64`. Linux uses the system CMake toolchain and honors `VCPKG_ROOT` when provided.

Npcap must be installed on a target Windows machine. The bridge loads Npcap at runtime so a missing installation produces a useful adapter error rather than preventing DARTWIC from loading the plugin. Npcap runtime binaries are not checked into this open-source repository because redistribution requires an [Npcap OEM license](https://nmap.org/npcap/oem/).

## TwinCAT EtherCAT simulation

Use an external SubDevice simulator when testing the complete NIC, packet-driver, and wire path. [Beckhoff TE1111 TwinCAT 3 EtherCAT Simulation](https://www.beckhoff.com/en-en/products/automation/twinsafe/twinsafe-software/te1111.html) is the recommended Windows option and is available in TwinCAT for demo testing.

Run TwinCAT simulation on a separate EtherCAT-facing adapter (or a second machine) connected to the adapter selected in DARTWIC. Install Npcap on the DARTWIC Windows host for that physical connection.

## Tests and 1 kHz rate check

The standard native test suite covers unaligned PDO encoding, signed/scaled values, dynamic C bridge loading, ABI validation, full-duplex exchange, and a 20,000-cycle bridge throughput test:

```shell
ctest --test-dir build/windows-clang-release -C Release --output-on-failure
```

`ethercat_rate_test` runs the same synchronous exchange interface used by the plugin and reports mean/p99 exchange time and 1 ms deadline misses:

```shell
ethercat_rate_test --bridge /path/to/dartwic_ethercat_bridge.dll --adapter ADAPTER_ID --cycles 10000 --period-us 1000
```

Run it against the intended NIC and TwinCAT or physical slave chain. This measures the same synchronous bridge exchange path used by the DARTWIC task and reports host-side cadence separately from on-wire exchange time.

The plugin publishes these fixed diagnostic channels per task:

- `<task>.ethercat.exchange_time_us`
- `<task>.ethercat.actual_wkc`
- `<task>.ethercat.expected_wkc`
- `<task>.ethercat.failure_count`

Three consecutive exchange failures stop the task. Automatic reconnect is intentionally deferred so a control system does not silently resume outputs after an ambiguous bus interruption.

## Repository layout

- `engine/`: DARTWIC module, cyclic task, prepared fixed-channel path, PDO codec, and bridge loader.
- `bridge/`: KickCAT-backed C ABI shared library.
- `interface/`: dropdown-driven module and task editors.
- `tests/`: codec, ABI loader, fake bridge, and throughput tests.
- `tools/ethercat_rate_test.cpp`: physical-adapter rate and deadline test.

## Current scope

This is an initial implementation intended for TwinCAT validation and hardware bring-up. Before production control use, validate the exact slave chain on the target real-time configuration, define application-specific output safety behavior, and measure worst-case—not only average—cycle latency.

EtherCAT® is a registered trademark and patented technology, licensed by Beckhoff Automation GmbH, Germany. This independent plugin is not affiliated with or endorsed by Beckhoff Automation or the EtherCAT Technology Group.

## Discovery setup presentation

Discovery uses the shared SDK resource descriptors: module connection status is listed under the module, while four cyclic diagnostics belong to the cyclic task. Editable PDO channel and state names use the shared channel picker; required diagnostic channels use checked, disabled rows. Review stays compact. The connection monitor is a shared plugin loop rather than a loop created per module. Channel name choices remain in the provisioning draft until Apply.

The connection monitor republishes `{instance}.info.connected` each second, with a three-second stale timeout. A failed task exchange clears internal health so the monitor verifies again rather than retaining a recent successful state. Missing or stale observations appear as unknown in the shared Interface indicator.

The specialized module page and connection icons are supplied by the Interface plugin. Deploy both the engine and Interface sides to their respective hosts; deploying only the native binary does not install the UI. Module pages use the shared host runtime overview and connection controls, matching the Modbus plugin while retaining device-specific settings. Reload an already-open Interface after a manual plugin-file deployment to clear cached missing-plugin results.

## Release package contract

Run `npm run package` on each supported native host. It must build both Release and Debug successfully before producing `plugin-win32-x64.zip` on Windows x64 or `plugin-linux-x64.zip` on Linux x64. Windows Debug PDB symbols are required. The ZIP includes `plugin/engine/ethercat/`, `plugin/engine-debug/ethercat/`, and `plugin/interface/ethercat/`; each contains the matching root `plugin.json`, native libraries live in each native tree's `bin/`, and the Interface entry point is `ui/index.js`. Required root configuration and runtime dependencies remain in the package; supporting files ship inside each plugin side's `assets/` directory.

Upload the root `plugin.json` and one or both exact platform ZIPs to the same GitHub release; keep that manifest in the tagged source too. The tag, package, and every manifest must identify the same version. `release-manifest.json` provides generated SHA-256 checksums. Generic `plugin.zip` and separate debug ZIPs are not accepted. The Engine selects its OS and Release/Debug variant; it never falls back to a different OS.

See the [example plugin's full release contract](https://github.com/kemptonburton/dartwic-example-plugin#github-release-contract) for the complete manifest shape and archive tree. Native packaging requires `VCPKG_ROOT`; optionally set `DARTWIC_VCPKG_INSTALLED_DIR` to reuse installed dependencies. Packaging does not deploy, push, or publish.

## Asset ownership

Managed files in this repository's `assets/` ship inside the installed plugin and
are replaced with it. Keep custom shared files in
`workspace/assets/plugins/<plugin-id>/` using the SDK helpers. Project settings
remain project-scoped; local secrets and runtime data belong to Engine instances.
Workspaces contain authored Git-trackable content; installed Engine and Interface
directories contain replaceable software and local state. Plugin installation
does not copy files into workspaces. See `assets/README.md` for the storage rules.
