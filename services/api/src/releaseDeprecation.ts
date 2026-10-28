import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
import { deprecationFields } from "@uk-data-atlas/atlas-runtime/api";
import type { ApiResponse } from "@uk-data-atlas/atlas-runtime/api";

type BoundaryRelease = BoundaryRegistry["releases"][number];

/**
 * The geography and release a path names, for the resources whose path is a
 * boundary release: its own resource and join, the map resources built from
 * it and the areas in it.
 */
export const releaseInPath = (
	segments: string[],
): { geography: string; release: string } | undefined => {
	if (segments[0] !== "v1" || !segments[2] || !segments[3]) return undefined;
	const resource = segments[1];
	if (
		resource !== "boundary-releases" &&
		resource !== "map-resources" &&
		resource !== "areas"
	)
		return undefined;
	const release =
		resource === "boundary-releases"
			? segments[3].replace(/:join$/, "")
			: resource === "map-resources"
				? segments[3].replace(/\.pmtiles$/, "")
				: segments[3];
	return { geography: segments[2], release };
};

/**
 * `Deprecation`, `Sunset` and a `successor-version` link for a deprecated
 * release; nothing for any other.
 */
export const releaseDeprecationHeaders = (
	release: BoundaryRelease | undefined,
): Record<string, string> => {
	const deprecation = release?.deprecation;
	if (!release || !deprecation) return {};
	return {
		...deprecationFields(deprecation.deprecated, deprecation.sunset),
		link: `</v1/boundary-releases/${encodeURIComponent(release.geography)}/${encodeURIComponent(deprecation.replacedBy)}>; rel="successor-version"`,
	};
};

/** Add release headers to a response's own, joining any `Link` it carries. */
export const withReleaseHeaders = (
	response: ApiResponse,
	release: BoundaryRelease | undefined,
): ApiResponse => {
	const added = releaseDeprecationHeaders(release);
	if (Object.keys(added).length === 0) return response;
	const own = response.headers ?? {};
	return {
		...response,
		headers: {
			...own,
			...added,
			...(own.link ? { link: `${own.link}, ${added.link}` } : {}),
		},
	};
};
