import type { AreaLookup, AreaRecord } from "./areaInventory";
import { releaseKey } from "./geographyKeys";
import {
	NAME_NORMALISATION,
	normalisePlaceName,
	withoutTitle,
} from "./nameNormalisation";
import {
	atEach,
	compareCodeUnits,
	findNumber,
	findSorted,
	lowerBound,
	type Indexed,
} from "./sortedIndex";
import { sha256 } from "./contentHash";
import {
	packPositions,
	SqliteIndex,
	text,
	unpackPositions,
	type SqliteTable,
} from "./sqliteIndex";

/**
 * The compiled area search index: every area identity, one per release and
 * code, and the codes, names and aliases it can be found by.
 *
 * An identity's position is its place in id order, counting through
 * `releases` and then each release's `codes`. Ids sort by code unit, so each
 * release's identities are contiguous and a position is found by two binary
 * searches. Postings hold positions in ascending order, which is id order, so
 * results merged from several terms need only a numeric sort.
 */
export type AreaSearchIndexArtifact = {
	schemaVersion: 1;
	contentHash: string;
	/** The `NAME_NORMALISATION` fingerprint every term was normalised under. */
	nameNormalisation: string;
	areaInventoryHash: string;
	/** Sorted by `geography/boundaryRelease/`, the prefix of their ids. */
	releases: Array<{
		geography: string;
		boundaryRelease: string;
		/** Sorted by code unit. */
		codes: string[];
	}>;
	/** Every normalised code, name and alias, sorted, for prefix search. */
	terms: string[];
	/** The identities behind each of `terms`, position for position. */
	termAreas: number[][];
	/**
	 * Every normalised name and alias with its administrative title set aside,
	 * for exact resolution only: "bristol" for "Bristol, City of".
	 */
	titleTerms: string[];
	titleTermAreas: number[][];
};

/**
 * What a search reads from the index: the artifact itself, or its tables in
 * SQLite, as the server reads it.
 */
export type AreaSearchIndex = {
	releases: ReadonlyArray<{
		geography: string;
		boundaryRelease: string;
		codes: Indexed<string>;
	}>;
	terms: Indexed<string>;
	termAreas: Indexed<readonly number[]>;
	titleTerms: Indexed<string>;
	titleTermAreas: Indexed<readonly number[]>;
};

type AreaSearchIndexHeader = Pick<
	AreaSearchIndexArtifact,
	"schemaVersion" | "contentHash" | "nameNormalisation" | "areaInventoryHash"
>;

export type AreaSearchResult = AreaRecord & {
	id: string;
	geography: string;
	boundaryRelease: string;
};

export type AreaSearchFilters = {
	geography?: string | null;
	boundaryRelease?: string | null;
};

const releasePrefix = (geography: string, boundaryRelease: string) =>
	`${geography}/${boundaryRelease}/`;

const postings = (byTerm: Map<string, Set<number>>) => {
	const terms = [...byTerm.keys()].sort(compareCodeUnits);
	return {
		terms,
		areas: terms.map((term) =>
			[...byTerm.get(term)!].sort((left, right) => left - right),
		),
	};
};

export const compileAreaSearchIndex = (
	areaLookup: AreaLookup,
	areaInventoryHash: string,
): AreaSearchIndexArtifact => {
	const releases = [...areaLookup.entries()]
		.map(([key, areas]) => {
			const slash = key.indexOf("/");
			return {
				geography: key.slice(0, slash),
				boundaryRelease: key.slice(slash + 1),
				codes: [...areas.keys()].sort(compareCodeUnits),
				areas,
			};
		})
		.sort((left, right) =>
			compareCodeUnits(
				releasePrefix(left.geography, left.boundaryRelease),
				releasePrefix(right.geography, right.boundaryRelease),
			),
		);
	const byTerm = new Map<string, Set<number>>();
	const byTitleTerm = new Map<string, Set<number>>();
	const post = (
		index: Map<string, Set<number>>,
		term: string,
		at: number,
	) => {
		const list = index.get(term);
		if (list) list.add(at);
		else index.set(term, new Set([at]));
	};
	let position = 0;
	for (const release of releases) {
		for (const code of release.codes) {
			const area = release.areas.get(code)!;
			const term = normalisePlaceName(code);
			if (term) post(byTerm, term, position);
			for (const label of [area.name, ...(area.aliases ?? [])]) {
				const normalised = normalisePlaceName(label);
				if (!normalised) continue;
				post(byTerm, normalised, position);
				const stripped = withoutTitle(normalised);
				if (stripped) post(byTitleTerm, stripped, position);
			}
			position += 1;
		}
	}
	const named = postings(byTerm);
	const titled = postings(byTitleTerm);
	const body = {
		schemaVersion: 1 as const,
		nameNormalisation: NAME_NORMALISATION,
		areaInventoryHash,
		releases: releases.map(({ geography, boundaryRelease, codes }) => ({
			geography,
			boundaryRelease,
			codes,
		})),
		terms: named.terms,
		termAreas: named.areas,
		titleTerms: titled.terms,
		titleTermAreas: titled.areas,
	};
	return { ...body, contentHash: sha256(JSON.stringify(body)) };
};

/**
 * Whether an artifact can serve searches over this area inventory, under the
 * normalisation this API applies to a query. Undefined when it can.
 */
export const areaSearchIndexMismatch = (
	artifact: AreaSearchIndexArtifact,
	areaInventoryHash: string,
): string | undefined => {
	if (
		artifact.schemaVersion !== 1 ||
		!Array.isArray(artifact.releases) ||
		!Array.isArray(artifact.terms) ||
		!Array.isArray(artifact.termAreas) ||
		!Array.isArray(artifact.titleTerms) ||
		!Array.isArray(artifact.titleTermAreas) ||
		artifact.terms.length !== artifact.termAreas.length ||
		artifact.titleTerms.length !== artifact.titleTermAreas.length
	)
		return "is malformed";
	return headerMismatch(artifact, areaInventoryHash);
};

const headerMismatch = (
	artifact: AreaSearchIndexHeader,
	areaInventoryHash: string,
): string | undefined => {
	if (artifact.schemaVersion !== 1) return "is malformed";
	if (artifact.nameNormalisation !== NAME_NORMALISATION)
		return "was normalised under different name rules than this API applies";
	if (artifact.areaInventoryHash !== areaInventoryHash)
		return "was not built from the current area inventory";
	return undefined;
};

/**
 * The identities a search matched, in id order, read only as far as a page
 * needs.
 */
export type AreaMatches = {
	length: number;
	/** Where the identity with this id falls among the matches, or -1. */
	positionOf(id: string): number;
	slice(start: number, end: number): AreaSearchResult[];
};

/** Searches over a compiled index, reading area records from the inventory. */
export class AreaSearch {
	/** Where each release's identities begin, and one past the last. */
	private readonly offsets: number[];
	private readonly prefixes: string[];

	constructor(
		private readonly index: AreaSearchIndex,
		private readonly areaLookup: AreaLookup,
	) {
		this.offsets = [0];
		for (const release of index.releases)
			this.offsets.push(this.offsets.at(-1)! + release.codes.length);
		this.prefixes = index.releases.map((release) =>
			releasePrefix(release.geography, release.boundaryRelease),
		);
	}

	private releaseAt(position: number) {
		let low = 0;
		let high = this.index.releases.length - 1;
		while (low < high) {
			const middle = (low + high + 1) >> 1;
			if (this.offsets[middle]! <= position) low = middle;
			else high = middle - 1;
		}
		return low;
	}

	/** The codes at several positions, read a release at a time. */
	private codesAt(positions: readonly number[]) {
		const codes = new Array<string>(positions.length);
		const byRelease = new Map<number, number[]>();
		positions.forEach((position, index) => {
			const at = this.releaseAt(position);
			const indexes = byRelease.get(at);
			if (indexes) indexes.push(index);
			else byRelease.set(at, [index]);
		});
		for (const [at, indexes] of byRelease) {
			const found = atEach(
				this.index.releases[at]!.codes,
				indexes.map((index) => positions[index]! - this.offsets[at]!),
			);
			indexes.forEach((index, within) => {
				codes[index] = found[within]!;
			});
		}
		return codes;
	}

	private results(positions: readonly number[]): AreaSearchResult[] {
		const codes = this.codesAt(positions);
		return positions.map((position, index) => {
			const { geography, boundaryRelease } =
				this.index.releases[this.releaseAt(position)]!;
			const code = codes[index]!;
			const area = this.areaLookup
				.get(releaseKey(geography, boundaryRelease))!
				.get(code)!;
			return {
				id: `${geography}/${boundaryRelease}/${code}`,
				geography,
				boundaryRelease,
				...area,
			};
		});
	}

	/** The position of the identity with this id, or -1. */
	private positionOfId(id: string) {
		const slash = id.lastIndexOf("/");
		if (slash === -1) return -1;
		const at = findSorted(this.prefixes, id.slice(0, slash + 1));
		if (at === -1) return -1;
		const within = findSorted(
			this.index.releases[at]!.codes,
			id.slice(slash + 1),
		);
		return within === -1 ? -1 : this.offsets[at]! + within;
	}

	/** The positions in `releases` of those the filters admit. */
	private admitted({ geography, boundaryRelease }: AreaSearchFilters) {
		return this.index.releases.flatMap((release, at) =>
			(geography == null || release.geography === geography) &&
			(boundaryRelease == null ||
				release.boundaryRelease === boundaryRelease)
				? [at]
				: [],
		);
	}

	private matches(positions: number[]): AreaMatches {
		return {
			length: positions.length,
			positionOf: (id) => {
				const position = this.positionOfId(id);
				return position === -1 ? -1 : findNumber(positions, position);
			},
			slice: (start, end) => this.results(positions.slice(start, end)),
		};
	}

	/**
	 * Every identity in the given releases, without listing them: a listing
	 * can span every compiled area, and a page needs only a few.
	 */
	private releaseMatches(releases: number[]): AreaMatches {
		// Where each release's identities begin among the matches.
		const starts = [0];
		for (const at of releases)
			starts.push(
				starts.at(-1)! + this.offsets[at + 1]! - this.offsets[at]!,
			);
		const length = starts.at(-1)!;
		return {
			length,
			positionOf: (id) => {
				const position = this.positionOfId(id);
				if (position === -1) return -1;
				const index = releases.indexOf(this.releaseAt(position));
				return index === -1
					? -1
					: starts[index]! +
							position -
							this.offsets[releases[index]!]!;
			},
			slice: (start, end) => {
				const positions: number[] = [];
				const last = Math.min(end, length);
				let index = 0;
				for (let match = Math.max(start, 0); match < last; match += 1) {
					while (starts[index + 1]! <= match) index += 1;
					positions.push(
						this.offsets[releases[index]!]! +
							match -
							starts[index]!,
					);
				}
				return this.results(positions);
			},
		};
	}

	private filtered(positions: Iterable<number>, filters: AreaSearchFilters) {
		const releases = new Set(this.admitted(filters));
		const kept: number[] = [];
		for (const position of positions) {
			if (releases.has(this.releaseAt(position))) kept.push(position);
		}
		return kept.sort((left, right) => left - right);
	}

	/**
	 * Every identity the filters admit or, given a query, an exact code match
	 * or else every identity with a code, name or alias beginning with it.
	 */
	search(filters: AreaSearchFilters & { query?: string }): AreaMatches {
		if (!filters.query) return this.releaseMatches(this.admitted(filters));
		const codeQuery = filters.query.toLocaleLowerCase();
		const nameQuery = normalisePlaceName(filters.query);
		if (!nameQuery) return this.matches([]);
		// An exact code is always a term, since codes are indexed as terms.
		const term = findSorted(this.index.terms, nameQuery);
		if (term !== -1) {
			const areas = this.index.termAreas.at(term)!;
			const codes = this.codesAt(areas);
			const exact = this.filtered(
				areas.filter(
					(_, index) =>
						codes[index]!.toLocaleLowerCase() === codeQuery,
				),
				filters,
			);
			if (exact.length > 0) return this.matches(exact);
		}
		const found = new Set<number>();
		for (
			let position = lowerBound(this.index.terms, nameQuery);
			position < this.index.terms.length &&
			this.index.terms.at(position)!.startsWith(nameQuery);
			position += 1
		) {
			for (const area of this.index.termAreas.at(position)!)
				found.add(area);
		}
		return this.matches(this.filtered(found, filters));
	}

	/**
	 * Every identity whose code, name or alias could equal the query exactly,
	 * including once an administrative title is set aside. The caller decides
	 * which kind of match each one is.
	 */
	exactCandidates(
		filters: AreaSearchFilters & { query: string },
	): AreaSearchResult[] {
		const nameQuery = normalisePlaceName(filters.query);
		if (!nameQuery) return [];
		const term = findSorted(this.index.terms, nameQuery);
		const titleTerm = findSorted(this.index.titleTerms, nameQuery);
		return this.results(
			this.filtered(
				[
					...(term === -1 ? [] : this.index.termAreas.at(term)!),
					...(titleTerm === -1
						? []
						: this.index.titleTermAreas.at(titleTerm)!),
				],
				filters,
			).filter((position, index, all) => position !== all[index - 1]),
		);
	}
}

/** Codes in position order and term postings packed as u32s. */
export const areaSearchIndexTables = (
	index: AreaSearchIndexArtifact,
): Record<string, SqliteTable> => ({
	area_search_meta: {
		columns: ["key TEXT NOT NULL", "value TEXT NOT NULL"],
		key: ["key"],
		rows: Object.entries({
			schemaVersion: String(index.schemaVersion),
			contentHash: index.contentHash,
			nameNormalisation: index.nameNormalisation,
			areaInventoryHash: index.areaInventoryHash,
			releases: JSON.stringify(
				index.releases.map(({ geography, boundaryRelease, codes }) => ({
					geography,
					boundaryRelease,
					length: codes.length,
				})),
			),
		}),
	},
	area_search_codes: {
		columns: ["code TEXT"],
		rows: index.releases.flatMap((release) =>
			release.codes.map((code) => [code]),
		),
	},
	area_search_terms: {
		columns: ["term TEXT", "areas BLOB"],
		rows: index.terms.map((term, at) => [
			term,
			packPositions(index.termAreas[at]!),
		]),
	},
	area_search_title_terms: {
		columns: ["term TEXT", "areas BLOB"],
		rows: index.titleTerms.map((term, at) => [
			term,
			packPositions(index.titleTermAreas[at]!),
		]),
	},
});

/**
 * The index stored in the shared atlas database, refused unless built
 * from this area inventory.
 */
export const openAreaSearchIndexDatabase = (
	path: string,
	areaInventoryHash: string,
): AreaSearchIndex & { contentHash: string } => {
	const database = new SqliteIndex(path, "area_search_");
	const meta = (key: string) => database.meta.get(key) ?? "";
	const header: AreaSearchIndexHeader = {
		schemaVersion: Number(meta("schemaVersion")) as 1,
		contentHash: meta("contentHash"),
		nameNormalisation: meta("nameNormalisation"),
		areaInventoryHash: meta("areaInventoryHash"),
	};
	const mismatch = headerMismatch(header, areaInventoryHash);
	if (mismatch)
		throw new Error(`The area search index at ${path} ${mismatch}.`);
	const codes = database.table("codes");
	const terms = database.table("terms");
	const titleTerms = database.table("title_terms");
	let offset = 0;
	const releases = (
		JSON.parse(meta("releases")) as Array<{
			geography: string;
			boundaryRelease: string;
			length: number;
		}>
	).map(({ geography, boundaryRelease, length }) => {
		const release = {
			geography,
			boundaryRelease,
			codes: codes.column("code", text, offset, length),
		};
		offset += length;
		return release;
	});
	if (offset !== codes.length)
		throw new Error(`The area search index at ${path} is malformed.`);
	return {
		contentHash: header.contentHash,
		releases,
		terms: terms.column("term", text),
		termAreas: terms.column("areas", unpackPositions),
		titleTerms: titleTerms.column("term", text),
		titleTermAreas: titleTerms.column("areas", unpackPositions),
	};
};
