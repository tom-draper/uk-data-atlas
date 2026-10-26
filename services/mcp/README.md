# UK Data Atlas MCP server

An [MCP](https://modelcontextprotocol.io) server that lets an AI assistant
answer UK place questions with the UK Data Atlas API's data instead of from
memory. It exposes the API's front-door routes as eight read-only tools.

It is a thin HTTP client over the public API. It imports nothing from
`services/api`, holds no data of its own, sends only `GET` requests and needs
no credentials. Every answer keeps the API's own `defaults`, `method`,
`otherMatches` and source fields, and the URL it asked, so the assistant can
say what was defaulted and where a figure came from.

## Tools

| Tool                | Route                                                                              | Use it to                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `find_place`        | `GET /places?q=`                                                                   | Turn a name, code or postcode into every place it could mean. Never picks one.                                   |
| `find_measures`     | `GET /measures?q=`                                                                 | Find a measure id from the words people use ("house prices").                                                    |
| `get_value`         | `GET /data/{measure}/value?place=`                                                 | Answer "what is the population of North Wales?" in one call, naming the period and method.                       |
| `get_series`        | `GET /data/{measure}/series?place=`                                                | Get a measure over time for one area, with the partition the API chose in `defaults`.                            |
| `locate`            | `GET /postcodes/{postcode}` or `GET /areas:contains`                               | Say which areas contain a postcode, a latitude and longitude, a British National Grid point or a grid reference. |
| `get_area`          | `GET /areas/{geography}/{release}/{code}` and its `history`, `parents`, `children` | Read one area, what it replaced or became, what contains it, or what it contains.                                |
| `convert_code`      | `GET /translations`                                                                | Translate a code between boundary releases through a published crosswalk.                                        |
| `boundary_releases` | `GET /boundary-releases`, `/boundary-releases/{geography}/{release}`, `:resolve`   | List releases, pick the one current on a date, or get a release with licence and download links.                 |

`locate` and `boundary_releases` choose their route from the arguments given,
and say so when the arguments conflict instead of guessing.

When the API refuses a request, the tool returns an error the assistant can act
on: a `409` lists the places the name could mean and asks it to choose, a `404`
or `422` is reported rather than estimated around, and a `429` says how long to
wait. Long answers are cut at 40,000 characters with a note saying so.

## Run it

From the repository root:

```sh
pnpm install
pnpm --dir services/mcp start
```

The server speaks MCP over stdio, so it waits for a client rather than printing
anything. By default it reads from the production API,
`https://api.ukdataatlas.com/v1`. Set `UK_DATA_ATLAS_API_URL` to use another,
for example a local one from `pnpm --dir services/api start:dev`:

```sh
UK_DATA_ATLAS_API_URL=http://127.0.0.1:3001/v1 pnpm --dir services/mcp start
```

The API is in early access and rate limits each client, so a busy session may
see `429` replies.

## Add it to a client

Replace `/path/to/uk-data-atlas` with your checkout. The commands call the
checkout's own `tsx` directly, so they work without `pnpm` on the client's
`PATH`.

### Claude Desktop

Open Settings, Developer, Edit Config, and add to `claude_desktop_config.json`:

```json
{
	"mcpServers": {
		"uk-data-atlas": {
			"command": "/path/to/uk-data-atlas/services/mcp/node_modules/.bin/tsx",
			"args": ["/path/to/uk-data-atlas/services/mcp/src/cli.ts"]
		}
	}
}
```

Restart Claude Desktop. To use a different API add
`"env": { "UK_DATA_ATLAS_API_URL": "http://127.0.0.1:3001/v1" }`.

### Claude Code

```sh
claude mcp add uk-data-atlas -- \
  /path/to/uk-data-atlas/services/mcp/node_modules/.bin/tsx \
  /path/to/uk-data-atlas/services/mcp/src/cli.ts
```

Add `-e UK_DATA_ATLAS_API_URL=http://127.0.0.1:3001/v1` before the server name to
point it at another API. Check it with `claude mcp list`.

### Cursor, VS Code, and other clients

Any client that can start a stdio server needs the same three things: a
command, its arguments, and optionally environment variables. For Cursor
(`.cursor/mcp.json`) use the Claude Desktop block above. For VS Code
(`.vscode/mcp.json`) the top-level key is `servers` and each entry takes a
`"type": "stdio"`:

```json
{
	"servers": {
		"uk-data-atlas": {
			"type": "stdio",
			"command": "/path/to/uk-data-atlas/services/mcp/node_modules/.bin/tsx",
			"args": ["/path/to/uk-data-atlas/services/mcp/src/cli.ts"]
		}
	}
}
```

The server's `instructions` ask the assistant to state the period, method and
anything defaulted when it quotes a figure, to credit the publishers named in
the reply, and never to choose silently between ambiguous places.

## Develop

```sh
pnpm --dir services/mcp typecheck
pnpm --dir services/mcp test
```

The tests mock `fetch`: each tool's request mapping and its handling of `404`,
`409` ambiguous places, `422` and `429`, plus a run through the real MCP
protocol over an in-memory transport. `pnpm check` runs them.

An optional smoke test starts the real server over stdio and calls a running
API through it. It is not part of `pnpm check` and needs the network or a local
API:

```sh
pnpm --dir services/mcp smoke                            # production
pnpm --dir services/mcp smoke http://127.0.0.1:3001/v1   # a local API
```

## Where it sits

It lives in `services/`, not `packages/`, because it is a runnable Node program
rather than browser-safe shared code, and `packages/*` may import no Node
built-ins. It reaches the API only over HTTP, so a boundary test in
`tests/packages/packageImports.test.ts` keeps it free of repository imports.

## Not done yet

- Streamable HTTP transport. Only stdio is offered.
- Publishing to npm or any registry. The package is `private`; run it from a
  checkout.
- API keys. The API has none yet, and the server sends no credentials.
- Tools for the advanced routes: matching or joining your own data (which
  take a request body), rankings, comparisons and map tiles.
