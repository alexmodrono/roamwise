# Set up Roamwise for your coding agent

Roamwise opens `*-trip.yaml` files in a live, read-only browser preview. Your agent writes the YAML; the preview updates when the file changes. It works with local Codex, Claude Code, and Cursor sessions with shell access and Node.js 22.13 or newer.

## Add the Roamwise skill

Install the skill using the Skills CLI from `alexmodrono/roamwise`:

```sh
npx skills add alexmodrono/roamwise --skill roamwise -g
```

Choose your agent in the installer, or add `-a codex`, `-a claude-code`, or `-a cursor`. Omit `-g` for a project-local installation. Skills uses `add`, not `install`; a bare `roamwise` name is not the repository source. Update with `npx skills update roamwise -g`.

**Release status:** the skill is available from GitHub. `@roamwise/cli@0.1.0` has not yet been published by this project; use the release-tarball workflow below until the npm release is available.

From a source checkout, the skill can already be installed with:

```sh
npx skills add ./skills/roamwise -g
```

## Let your agent run the CLI

After the npm release is published, tell your agent: “Use Roamwise to plan my trip and open the preview.” The skill runs a pinned CLI through `npx`; you do not need a global installation:

```sh
npx --yes --package=@roamwise/cli@0.1.0 roamwise validate "trip.yaml" --json
npx --yes --package=@roamwise/cli@0.1.0 roamwise open "trip.yaml" --print-url --json
```

The first command may download the runtime into npm's cache. `open` returns a local URL immediately and leaves a shared preview server running. The agent reuses that preview while editing your YAML. Visible previews update live; hidden previews pause. The server stops after five minutes without connected viewers. Run the pinned open command again to obtain a new URL after shutdown.

For remote workspaces, use your environment's port forwarding; a remote localhost URL is not automatically available on your computer.

## Before the npm release

Download `/downloads/roamwise-cli-0.1.0.tgz` from this website. Run it without installing globally, using the absolute path to the downloaded tarball:

```sh
npm exec --yes --package=/absolute/path/roamwise-cli-0.1.0.tgz -- roamwise open "/absolute/path/trip.yaml" --print-url --json
```

From source, `npm ci` followed by `npm run pack:cli` produces the tarball under `packages/cli/`.

## ChatGPT and Claude chat

No installation is needed to generate a trip. Copy the website's “Copy prompt for your AI” prompt into your chat, describe the trip, and request a downloadable YAML file. Upload it or paste its contents on the website. Uploaded YAML is processed in your browser, browser edits can be downloaded, and maps and remote images may make network requests. Flight and listing refreshes are optional actions that send relevant details to those services.

The full format is at `/format.md`, JSON Schema at `/trip.schema.json`, and minimal example at `/trips/minimal-trip.yaml`.
