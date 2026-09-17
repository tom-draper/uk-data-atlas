import type { AreaLookup } from "./areaInventory";

export type AreaSearchResult = {
	id: string;
	geography: string;
	boundaryRelease: string;
	code: string;
	name: string;
	aliases?: string[];
};

export type AreaSearchIndex = AreaSearchResult[];

/** Every compiled area identity, sorted by id for stable pagination. */
export const createAreaSearchIndex = (
	areaLookup: AreaLookup,
): AreaSearchIndex =>
	[...areaLookup.entries()]
		.flatMap(([identity, areas]) => {
			const slash = identity.indexOf("/");
			const geography = identity.slice(0, slash);
			const boundaryRelease = identity.slice(slash + 1);
			return [...areas.values()].map((area) => ({
				id: [geography, boundaryRelease, area.code].join("/"),
				geography,
				boundaryRelease,
				...area,
			}));
		})
		.sort((left, right) => left.id.localeCompare(right.id));

const matchesAreaQuery = (area: AreaSearchResult, query: string) => {
	const normalized = query.toLocaleLowerCase();
	return (
		area.code.toLocaleLowerCase().startsWith(normalized) ||
		area.name.toLocaleLowerCase().startsWith(normalized) ||
		area.aliases?.some((alias) =>
			alias.toLocaleLowerCase().startsWith(normalized),
		) === true
	);
};

/** Exact code matches take precedence over code/name/alias prefixes. */
export const searchAreas = (
	index: AreaSearchIndex,
	{
		geography,
		boundaryRelease,
		query,
	}: {
		geography?: string | null;
		boundaryRelease?: string | null;
		query?: string;
	},
) => {
	const filtered = index.filter(
		(area) =>
			(geography == null || area.geography === geography) &&
			(boundaryRelease == null ||
				area.boundaryRelease === boundaryRelease),
	);
	if (!query) return filtered;
	const exact = filtered.filter(
		(area) => area.code.toLocaleLowerCase() === query.toLocaleLowerCase(),
	);
	return exact.length > 0
		? exact
		: filtered.filter((area) => matchesAreaQuery(area, query));
};
