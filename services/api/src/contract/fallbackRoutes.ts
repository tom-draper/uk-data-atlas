import type { FastifyInstance } from "fastify";
import { bindings, type RouteBinding } from "../routeHandlers";

type Owner = { pattern: RegExp; weight: number; binding: RouteBinding };

/**
 * Compile a Fastify path, where `:name` is a parameter, `::` a literal colon
 * and a trailing `*` the rest of the path, into a matcher over decoded paths.
 */
const compile = (url: string, binding: RouteBinding): Owner => {
	let source = "";
	let weight = 0;
	for (let at = 0; at < url.length; at += 1) {
		const char = url[at]!;
		if (char === ":" && url[at + 1] === ":") {
			source += ":";
			weight += 1;
			at += 1;
		} else if (char === ":") {
			source += "[^/]+";
			while (/\w/.test(url[at + 1] ?? "")) at += 1;
		} else if (char === "*") source += ".*";
		else {
			source += char.replaceAll(/[.+?^${}()|[\]\\]/g, String.raw`\$&`);
			weight += 1;
		}
	}
	return { pattern: new RegExp(`^${source}$`), weight, binding };
};

/**
 * Resources whose family answers every path beneath them, though most such
 * paths match no route of their own.
 */
const ownedResources: [string, RouteBinding][] = [
	["/v1/map-resources", bindings.mapResources],
	["/v1/terrain", bindings.terrain],
	["/v1/places", bindings.places],
	["/v1/postcodes", bindings.postcodes],
	["/v1/areas::contains", bindings.areaContains],
	["/v1/areas::containsBatch", bindings.areaContainsBatch],
	["/v1/areas::near", bindings.areaNear],
	["/v1/areas::validate", bindings.areaValidation],
	["/v1/attribution", bindings.governance],
	["/v1/locations", bindings.locations],
	["/v1/crosswalks", bindings.crosswalks],
	["/v1/atlas-release", bindings.sync],
	["/v1/datasets", bindings.catalogue],
	["/v1/analysis-geographies", bindings.analysisGeographies],
	["/v1/analysis::plan", bindings.analysisGeographies],
	["/v1/geographies", bindings.boundaries],
	["/v1/boundaries", bindings.boundaries],
	["/v1/boundary-releases", bindings.boundaries],
	["/v1/boundary-releases::resolve", bindings.boundaries],
	["/v1/boundary-releases::compare", bindings.boundaries],
];

/**
 * Learns which family answers each route as the routes are registered, so
 * that a request no route accepts, such as a POST of a GET-only resource, is
 * still answered by the family that owns the path. A route names its family
 * by the binding its handler carries.
 */
export const collectOwners = (app: FastifyInstance, prefix = "") => {
	const owners: Owner[] = ownedResources.flatMap(([url, binding]) => [
		compile(url, binding),
		compile(`${url}/*`, binding),
	]);
	app.addHook("onRoute", ({ url, config }) => {
		if (config?.binding)
			owners.push(compile(`${prefix}${url}`, config.binding));
	});
	/** The family whose most specific route pattern matches the path. */
	return (pathname: string): RouteBinding | undefined => {
		let path: string;
		try {
			// An encoded slash stays inside its segment, as it does for the router.
			path = pathname
				.split("/")
				.map((segment) =>
					decodeURIComponent(segment).replaceAll("/", "\u0000"),
				)
				.join("/");
		} catch {
			return undefined;
		}
		let best: Owner | undefined;
		for (const owner of owners)
			if (
				owner.pattern.test(path) &&
				(!best || owner.weight > best.weight)
			)
				best = owner;
		return best?.binding;
	};
};
