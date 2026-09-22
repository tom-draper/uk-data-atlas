import type { AreaLookup } from "./areaInventory";
import { normalisePlaceName } from "./placeResolver";

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

const matchesAreaQuery = (
	area: AreaSearchResult,
	codeQuery: string,
	nameQuery: string,
) => {
	return (
		area.code.toLocaleLowerCase().startsWith(codeQuery) ||
		normalisePlaceName(area.name).startsWith(nameQuery) ||
		area.aliases?.some((alias) =>
			normalisePlaceName(alias).startsWith(nameQuery),
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
	const codeQuery = query.toLocaleLowerCase();
	const nameQuery = normalisePlaceName(query);
	if (!nameQuery) return [];
	const exact = filtered.filter(
		(area) => area.code.toLocaleLowerCase() === codeQuery,
	);
	return exact.length > 0
		? exact
		: filtered.filter((area) =>
				matchesAreaQuery(area, codeQuery, nameQuery),
			);
};
