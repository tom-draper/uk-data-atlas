import type { DatabaseSync } from "node:sqlite";
import type { CaseHop } from "./backtestCases.ts";
import type { ConversionBasis, Step } from "./crosswalkSteps.ts";
import { createRouter, type Router } from "./routes.ts";

/**
 * Routes pinned by slug: the releases and crosswalks a backtest case or a
 * converted series names, resolved against a database.
 */

export type Resolver = {
	router: Router;
	releaseId(release: string): number;
	crosswalkId(slug: string): number;
};

export const createResolver = (database: DatabaseSync): Resolver => {
	const release = database.prepare(
		"SELECT id FROM area_releases WHERE geography = ? AND release = ?",
	);
	const crosswalk = database.prepare(
		"SELECT id FROM crosswalk WHERE slug = ?",
	);
	return {
		router: createRouter(database),
		releaseId(key) {
			const [geography, name] = key.split(":");
			const row = release.get(geography!, name!) as
				{ id: number } | undefined;
			if (!row) throw new Error(`No release ${key}`);
			return row.id;
		},
		crosswalkId(slug) {
			const row = crosswalk.get(slug) as { id: number } | undefined;
			if (!row) throw new Error(`No crosswalk ${slug}`);
			return row.id;
		},
	};
};

/** The steps of a pinned route, which must start at `from` and join end to end. */
export const stepsOf = (
	resolver: Resolver,
	hops: readonly CaseHop[],
	basis: ConversionBasis,
	from: number,
): Step[] => {
	let at = from;
	return hops.map((hop) => {
		const made = resolver.router.hop(
			hop.crosswalks.map(resolver.crosswalkId),
			hop.reversed,
		);
		if (made.fromRelease !== at)
			throw new Error(
				`Hop ${hop.crosswalks.join(", ")} does not start where the route has reached`,
			);
		at = made.toRelease;
		return resolver.router.step(made, basis);
	});
};
