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

export type AreaSearchIndex = {
	/** Every identity, sorted by id for unfiltered listing and stable cursors. */
	areas: AreaSearchResult[];
	/** Case-insensitive codes, for the exact-match precedence rule. */
	exactCodes: Map<string, AreaSearchResult[]>;
	/** Every code, name and alias reduced to a searchable prefix key. */
	terms: string[];
	byTerm: Map<string, AreaSearchResult[]>;
};

const lowerBound = (values: string[], target: string) => {
	let low = 0;
	let high = values.length;
	while (low < high) {
		const middle = Math.floor((low + high) / 2);
		if (values[middle]!.localeCompare(target) < 0) low = middle + 1;
		else high = middle;
	}
	return low;
};

const add = <T>(index: Map<string, T[]>, key: string, value: T) => {
	const values = index.get(key);
	if (values) values.push(value);
	else index.set(key, [value]);
};

const matchingFilters = (
	area: AreaSearchResult,
	geography?: string | null,
	boundaryRelease?: string | null,
) =>
	(geography == null || area.geography === geography) &&
	(boundaryRelease == null || area.boundaryRelease === boundaryRelease);

/** Immutable exact-code and prefix indexes over every compiled area identity. */
export const createAreaSearchIndex = (
	areaLookup: AreaLookup,
): AreaSearchIndex => {
	const areas = [...areaLookup.entries()]
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
	const exactCodes = new Map<string, AreaSearchResult[]>();
	const byTerm = new Map<string, AreaSearchResult[]>();
	for (const area of areas) {
		add(exactCodes, area.code.toLocaleLowerCase(), area);
		for (const label of [area.code, area.name, ...(area.aliases ?? [])]) {
			const term = normalisePlaceName(label);
			if (term) add(byTerm, term, area);
		}
	}
	for (const matches of byTerm.values()) {
		const unique = new Map(matches.map((area) => [area.id, area]));
		matches.splice(0, matches.length, ...unique.values());
	}
	return {
		areas,
		exactCodes,
		terms: [...byTerm.keys()].sort((left, right) => left.localeCompare(right)),
		byTerm,
	};
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
	const matches = (area: AreaSearchResult) =>
		matchingFilters(area, geography, boundaryRelease);
	if (!query) return index.areas.filter(matches);
	const codeQuery = query.toLocaleLowerCase();
	const nameQuery = normalisePlaceName(query);
	if (!nameQuery) return [];
	const exact = (index.exactCodes.get(codeQuery) ?? []).filter(matches);
	if (exact.length > 0) return exact;
	const found = new Map<string, AreaSearchResult>();
	for (
		let position = lowerBound(index.terms, nameQuery);
		position < index.terms.length &&
		index.terms[position]!.startsWith(nameQuery);
		position += 1
	) {
		for (const area of index.byTerm.get(index.terms[position]!) ?? []) {
			if (matches(area)) found.set(area.id, area);
		}
	}
	return [...found.values()].sort((left, right) =>
		left.id.localeCompare(right.id),
	);
};
