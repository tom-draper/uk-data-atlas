import type { AreaSearchIndexArtifact } from "./areaSearchCompiler";
export {
	compileAreaSearchIndex,
	areaSearchIndexTables,
	type AreaSearchIndexArtifact,
} from "./areaSearchCompiler";
import type { AreaLookup, AreaRecord } from "./areaInventory";
import { releaseKey } from "@uk-data-atlas/geography";
import { NAME_NORMALISATION } from "./nameNormalisation";
import { normalisePlaceName, withoutTitle } from "@uk-data-atlas/geography";
import {
	atEach,
	findNumber,
	findSorted,
	lowerBound,
	type Indexed,
} from "./sortedIndex";
import { SqliteIndex, text, unpackPositions } from "./sqliteIndex";

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
