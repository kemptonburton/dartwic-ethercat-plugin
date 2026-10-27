# EtherCAT 2.1.0

- Refresh Engine and Interface SDK snapshots and rebuild native and Interface outputs.
- Require Engine 2.1.0 with plugin ABI 6; preserve the existing minimum Interface version.
- Prepared locally for the DARTWIC 2.1 bundle; not published.

# EtherCAT 0.1.1

- Refreshed the bundled Engine and Interface SDK snapshots, including settings, shared assets, and Markdown helpers.
- Rebuilt the Windows x64 engine plugin, KickCAT C bridge, and interface bundle.
- Verified bundled source locks and materialized the packaged interface registry.
- Included the development branch's discovery ownership and quiet interface logging fixes.

This SDK refresh targets the current DARTWIC 2.0 development host. Install Npcap
and use a dedicated EtherCAT adapter as described in README. This
release was build/package tested, not exercised against a live slave chain. No
Linux binary or timing guarantee is included in this Windows release.
