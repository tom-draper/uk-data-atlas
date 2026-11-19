import { collectOwners } from "../src/contract/fallbackRoutes";
import { createContractApp } from "../src/contract/generatedRoutes";
import type { RouteBinding } from "../src/routeHandlers";
import { route as send, routeAsync as sendAsync } from "../src/routes";
import type {
	RequestBody,
	RouteDispatchContext,
} from "../src/runtime/index.ts";

let ownerOf: (pathname: string) => RouteBinding | undefined = () => undefined;
await createContractApp(
	{ boundaryRegistry: { schemaVersion: 1, contentHash: "", releases: [] } },
	(app) => {
		ownerOf = collectOwners(app, "/v1");
	},
);

/** The binding the production router would hand the request to. */
const bindingFor = (url: string | undefined) =>
	ownerOf(new URL(url ?? "/", "http://localhost").pathname);

/** `route`, as production calls it for the family that owns the path. */
export const route = (
	method: string | undefined,
	url: string | undefined,
	context: RouteDispatchContext,
	body?: RequestBody,
) => send(method, url, context, body, bindingFor(url));

export const routeAsync = (
	method: string | undefined,
	url: string | undefined,
	context: RouteDispatchContext,
	body?: RequestBody,
) => sendAsync(method, url, context, body, bindingFor(url));
