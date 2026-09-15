# Roamwise CLI

Open portable YAML trip plans in a live local browser preview. Node.js 22.13+.

```sh
npx --yes --package=@roamwise/cli@0.1.0 roamwise validate seville-trip.yaml --json
npx --yes --package=@roamwise/cli@0.1.0 roamwise open seville-trip.yaml
npx --yes --package=@roamwise/cli@0.1.0 roamwise open seville-trip.yaml --print-url --json
npx skills add alexmodrono/roamwise --skill roamwise -g
```

The GitHub repository is `alexmodrono/roamwise`. The skill can be installed now; the npm release is not yet published by this checkout. Skills installs the instructions; the agent runs the pinned runtime through `npx`, with no global CLI installation. Use `-a codex`, `-a claude-code`, or `-a cursor` to target an agent.

For an unpublished release tarball, use `npm exec --yes --package=/absolute/path/roamwise-cli-0.1.0.tgz -- roamwise open /absolute/path/trip.yaml --print-url --json`.

`open` starts/reuses a background loopback server and returns immediately. File edits, including atomic replacements, update the preview. Invalid YAML leaves the last valid trip visible with diagnostics. The viewer is read-only; it never overwrites your file. Maps and optional HTTPS images use network services; trip YAML is not uploaded.

`roamwise status --json` checks the server and `roamwise stop` stops it. Set `ROAMWISE_STATE_DIR` to isolate a server's state. For remote workspaces, arrange port forwarding using the host environment. Run `roamwise help agent` for skill installation instructions.

Validation exits 0 for valid files, 1 for invalid documents, and 2 for operational errors. Warnings do not make a document invalid.

### Idle resource use

The agent preview is a dedicated read-only page. Maps load on request and are released when the tab is hidden; no code editor is loaded. Hidden previews disconnect their live stream and catch up from the current file when visible again.

The server watches parent directories using filesystem events only while viewers are connected, preserving atomic-save, deletion and recreation updates. It falls back to one-second polling when native watching fails. On network filesystems that silently omit events, set `ROAMWISE_WATCH_MODE=poll` before starting the server. No disconnected file is polled.

After five minutes without connected viewers, including never-viewed sessions, the shared server exits. Run `roamwise open <file.yaml>` again after shutdown; the old URL cannot restart a process. Set `ROAMWISE_IDLE_MS` to a positive millisecond duration before starting a server to change the grace period. Opening a new trip during the grace period resets it; status checks do not.
