/**
 * Detail routes Fastify serves: the shape of the path, and whether the ids it
 * carries are ones Fastify can route the same way the old dispatcher does.
 * Anything else with the same shape falls back to the dispatcher.
 */
const detailRoutes: {
	pattern: RegExp;
	/** The ids with their percent-encoding removed, in path order. */
	accepts?: (ids: string[]) => boolean;
}[] = [
	{ pattern: /^\/v1\/(?:datasets|measures)\/([^/]+)$/ },
	{
		pattern: /^\/v1\/boundary-releases\/([^/]+)\/([^/]+)$/,
		// A release ending in `:join` is the join operation, not a release.
		accepts: ([, release]) =>
			!release!.endsWith(":join") || release!.length <= 5,
	},
	{ pattern: /^\/v1\/data\/([^/]+)\/export$/ },
];

/** Fastify limits a parameter to 100 characters and normalises dot segments. */
const routable = (raw: string, id: string) =>
	id !== "." && id !== ".." && id.length <= 100 && raw.length <= 100;

export const isFastifyDetailPath = (pathname: string) => {
	for (const { pattern, accepts } of detailRoutes) {
		const match = pattern.exec(pathname);
		if (!match) continue;
		const raws = match.slice(1) as string[];
		try {
			const ids = raws.map((raw) => decodeURIComponent(raw));
			return (
				(!accepts || accepts(ids)) &&
				raws.every((raw, index) => routable(raw, ids[index]!))
			);
		} catch {
			return false;
		}
	}
	return false;
};
