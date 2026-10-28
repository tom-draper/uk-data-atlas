import type { AreaLookup } from "./areaInventory";
import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
import type { NamedLocationInventory } from "./namedLocationTypes";
import { compareBoundaryReleases } from "@uk-data-atlas/catalogue";
import { NAME_NORMALISATION } from "@uk-data-atlas/search-index/node";
import { normalisePlaceName, withoutTitle } from "@uk-data-atlas/geography";
import { compareCodeUnits, type Indexed } from "@uk-data-atlas/search-index";
import { sha256 } from "./contentHash";
import type { SQLInputValue } from "node:sqlite";
import {
	packPositions,
	SqliteIndex,
	text,
	unpackPositions,
	type SqliteTable,
	type Row,
} from "./sqliteIndex";

/**
 * The compiled place index: every area and named location, and every name
 * they can be searched by, laid out so a request reads it without building
 * anything.
 *
 * Grouping some ninety thousand places across every release and normalising
 * each of their names takes over a second. The compiler does it once; the
 * resolver answers each query with binary searches over the sorted arrays
 * below.
 */

export type CompiledPlace = {
	/**
	 * A reference that does not depend on a release: `localAuthority/E08000003`
	 * for an area, `location/north-west` for a curated location.
	 */
	place: string;
	kind: "area" | "named-location";
	geography: string;
	code: string;
	/** The name in the newest release carrying the code. */
	name: string;
	/**
	 * Positions in `releases` of the releases carrying this code, ascending
	 * and so newest first. Empty for a named location.
	 */
	boundaryReleases: number[];
	memberCodes?: string[];
	memberAssertions?: Array<{
		code: string;
		validity: { from: string | null; to: string | null };
	}>;
	memberGeography?: string;
	definitionRevision?: number;
	validity?: { from: string | null; to: string | null };
};

/**
 * One label a name was indexed from: the position of its place in `places`,
 * 1 when the name was reached by setting an administrative title aside, and
 * the label itself when it is not the place's name.
 */
export type CompiledPlaceLabel = [number, 0 | 1] | [number, 0 | 1, string];

export type PlaceIndexArtifact = {
	schemaVersion: 1;
	contentHash: string;
	/** The `NAME_NORMALISATION` fingerprint `names` were normalised under. */
	nameNormalisation: string;
	areaInventoryHash: string;
	namedLocationInventoryHash: string | null;
	/** Every boundary release id a place carries, newest first. */
	releases: string[];
	/** Sorted by `place`. */
	places: CompiledPlace[];
	/** Every normalised name, sorted, for exact and prefix search. */
	names: string[];
	/** The labels behind each of `names`, position for position. */
	labels: CompiledPlaceLabel[][];
	/** Every area code, sorted, for a query that is a bare code. */
	codes: string[];
	/** The places carrying each of `codes`, position for position. */
	codePlaces: number[][];
};

/**
 * What a search reads from the index: the artifact itself, or its tables in
 * SQLite, as the server reads it.
 */
export type PlaceIndex = {
	releases: readonly string[];
	places: Indexed<CompiledPlace>;
	names: Indexed<string>;
	labels: Indexed<CompiledPlaceLabel[]>;
	codes: Indexed<string>;
	codePlaces: Indexed<number[]>;
};

/** The fields an index is checked against before it serves a query. */
type PlaceIndexHeader = Pick<
	PlaceIndexArtifact,
	| "schemaVersion"
	| "contentHash"
	| "nameNormalisation"
	| "areaInventoryHash"
	| "namedLocationInventoryHash"
>;

/** The shape of a code a query can name directly: E08000003. */
export const AREA_CODE = /^[A-Z]\d{8}$/;

export const placeReference = (
	kind: "area" | "named-location",
	geography: string,
	code: string,
) => (kind === "named-location" ? `location/${code}` : `${geography}/${code}`);

type Grouped = Omit<CompiledPlace, "name" | "boundaryReleases"> & {
	/** Release to name, so the newest release's name wins. */
	names: Map<string, string>;
	boundaryReleases: Set<string>;
};

export type Label = { place: string; label: string; viaTitle: boolean };

export const preparePlaceIndex = (
	areaLookup: AreaLookup,
	namedLocations: NamedLocationInventory | undefined,
	boundaryRegistry: BoundaryRegistry | undefined,
	add: (name: string, entry: Label) => void,
) => {
	const registryReleases = new Map(
		boundaryRegistry?.releases.map((release) => [release.id, release]),
	);
	const grouped = new Map<string, Grouped>();
	const indexLabel = (label: string, place: string) => {
		const normalised = normalisePlaceName(label);
		if (!normalised) return;
		add(normalised, { place, label, viaTitle: false });
		const stripped = withoutTitle(normalised);
		if (stripped) add(stripped, { place, label, viaTitle: true });
	};

	for (const [key, areas] of areaLookup) {
		const [geography, boundaryRelease] = key.split("/") as [string, string];
		for (const area of areas.values()) {
			const place = placeReference("area", geography, area.code);
			const group = grouped.get(place) ?? {
				place,
				kind: "area" as const,
				geography,
				code: area.code,
				names: new Map<string, string>(),
				boundaryReleases: new Set<string>(),
			};
			group.names.set(boundaryRelease, area.name);
			group.boundaryReleases.add(boundaryRelease);
			grouped.set(place, group);
			for (const label of [area.name, ...(area.aliases ?? [])]) {
				indexLabel(label, place);
			}
		}
	}
	for (const location of namedLocations?.locations ?? []) {
		const place = placeReference(
			"named-location",
			"named-location",
			location.id,
		);
		grouped.set(place, {
			place,
			kind: "named-location",
			geography: "named-location",
			code: location.id,
			names: new Map([["", location.label]]),
			boundaryReleases: new Set(),
			memberCodes: location.memberCodes,
			memberAssertions: location.memberAssertions,
			memberGeography: location.memberGeography,
			definitionRevision: location.definitionRevision,
			validity: location.validity,
		});
		indexLabel(location.label, place);
	}

	const releases = [
		...new Set(
			[...grouped.values()].flatMap((group) => [
				...group.boundaryReleases,
			]),
		),
	]
		.sort((left, right) => {
			const leftRelease = registryReleases.get(left);
			const rightRelease = registryReleases.get(right);
			return leftRelease && rightRelease
				? compareBoundaryReleases(leftRelease, rightRelease)
				: left.localeCompare(right);
		})
		.reverse();
	const releasePosition = new Map(
		releases.map((release, index) => [release, index]),
	);
	const places: CompiledPlace[] = [...grouped.values()]
		.sort((left, right) => compareCodeUnits(left.place, right.place))
		.map(({ names, boundaryReleases, ...place }) => {
			const positions = [...boundaryReleases]
				.map((release) => releasePosition.get(release)!)
				.sort((left, right) => left - right);
			const newest = releases[positions[0] ?? -1];
			return {
				place: place.place,
				kind: place.kind,
				geography: place.geography,
				code: place.code,
				name: names.get(newest ?? "") ?? [...names.values()][0] ?? "",
				boundaryReleases: positions,
				...(place.memberCodes
					? { memberCodes: place.memberCodes }
					: {}),
				...(place.memberAssertions
					? { memberAssertions: place.memberAssertions }
					: {}),
				...(place.memberGeography
					? { memberGeography: place.memberGeography }
					: {}),
				...(place.definitionRevision
					? { definitionRevision: place.definitionRevision }
					: {}),
				...(place.validity ? { validity: place.validity } : {}),
			};
		});
	return { releases, places };
};

export const finishPlaceIndex = (
	prepared: ReturnType<typeof preparePlaceIndex>,
	names: string[],
	labels: CompiledPlaceLabel[][],
	areaInventoryHash: string,
	namedLocations: NamedLocationInventory | undefined,
): PlaceIndexArtifact => {
	const { releases, places } = prepared;

	const byCode = new Map<string, number[]>();
	places.forEach((place, index) => {
		if (!AREA_CODE.test(place.code)) return;
		const list = byCode.get(place.code);
		if (list) list.push(index);
		else byCode.set(place.code, [index]);
	});
	const codes = [...byCode.keys()].sort(compareCodeUnits);

	const body = {
		schemaVersion: 1 as const,
		nameNormalisation: NAME_NORMALISATION,
		areaInventoryHash,
		namedLocationInventoryHash: namedLocations?.contentHash ?? null,
		releases,
		places,
		names,
		labels,
		codes,
		codePlaces: codes.map((code) => byCode.get(code)!),
	};
	return { ...body, contentHash: sha256(JSON.stringify(body)) };
};

export const compilePlaceIndex = (
	areaLookup: AreaLookup,
	namedLocations: NamedLocationInventory | undefined,
	areaInventoryHash: string,
	boundaryRegistry?: BoundaryRegistry,
): PlaceIndexArtifact => {
	const byName = new Map<string, Label[]>();
	const prepared = preparePlaceIndex(
		areaLookup,
		namedLocations,
		boundaryRegistry,
		(name, entry) => {
			const list = byName.get(name);
			if (!list) byName.set(name, [entry]);
			else if (
				!list.some(
					(existing) =>
						existing.place === entry.place &&
						existing.label === entry.label,
				)
			)
				list.push(entry);
		},
	);
	const position = new Map(
		prepared.places.map((place, index) => [place.place, index]),
	);
	const names = [...byName.keys()].sort(compareCodeUnits);
	const labels = names.map((name) =>
		byName.get(name)!.map((entry): CompiledPlaceLabel => {
			const index = position.get(entry.place)!;
			const viaTitle = entry.viaTitle ? 1 : 0;
			return entry.label === prepared.places[index]!.name
				? [index, viaTitle]
				: [index, viaTitle, entry.label];
		}),
	);
	return finishPlaceIndex(
		prepared,
		names,
		labels,
		areaInventoryHash,
		namedLocations,
	);
};

/**
 * Whether an artifact can serve queries against this area inventory and set of
 * named locations: built from them, under the normalisation this API applies
 * to a query, with its parallel arrays aligned. Undefined when it can.
 */
export const placeIndexMismatch = (
	artifact: PlaceIndexArtifact,
	areaInventoryHash: string,
	namedLocations: NamedLocationInventory | undefined,
): string | undefined => {
	if (
		artifact.schemaVersion !== 1 ||
		!Array.isArray(artifact.releases) ||
		!Array.isArray(artifact.places) ||
		!Array.isArray(artifact.names) ||
		!Array.isArray(artifact.labels) ||
		!Array.isArray(artifact.codes) ||
		!Array.isArray(artifact.codePlaces) ||
		artifact.names.length !== artifact.labels.length ||
		artifact.codes.length !== artifact.codePlaces.length
	)
		return "is malformed";
	return headerMismatch(artifact, areaInventoryHash, namedLocations);
};

const headerMismatch = (
	artifact: PlaceIndexHeader,
	areaInventoryHash: string,
	namedLocations: NamedLocationInventory | undefined,
): string | undefined => {
	if (artifact.schemaVersion !== 1) return "is malformed";
	if (artifact.nameNormalisation !== NAME_NORMALISATION)
		return "was normalised under different name rules than this API applies";
	if (artifact.areaInventoryHash !== areaInventoryHash)
		return "was not built from the current area inventory";
	if (
		artifact.namedLocationInventoryHash !==
		(namedLocations?.contentHash ?? null)
	)
		return "was not built from the current named locations";
	return undefined;
};

/**
 * A place as table columns. What the rest implies is left out: the reference
 * when it follows from the kind and code, the name when it is the code, and
 * the kind when it is an area. Most places are output areas named by their
 * codes, so most rows are a geography, a code and a release.
 */
const placeColumns = (
	place: CompiledPlace,
	geographies: Map<string, number>,
) => {
	const {
		place: reference,
		kind,
		geography,
		code,
		name,
		boundaryReleases,
		...rest
	} = place;
	const extra: Record<string, unknown> = { ...rest };
	if (kind !== "area") extra.kind = kind;
	if (reference !== placeReference(kind, geography, code))
		extra.place = reference;
	return [
		geographies.get(geography)!,
		code,
		name === code ? null : name,
		boundaryReleases.join(","),
		Object.keys(extra).length > 0 ? JSON.stringify(extra) : null,
	];
};

const placeFromColumns =
	(geographies: string[]) =>
	(row: Row): CompiledPlace => {
		const geography = geographies[row.geography as number]!;
		const code = row.code as string;
		const {
			kind = "area",
			place,
			...rest
		} = row.extra === null
			? ({} as Partial<CompiledPlace>)
			: (JSON.parse(row.extra as string) as Partial<CompiledPlace>);
		const releases = row.releases as string;
		return {
			place: place ?? placeReference(kind, geography, code),
			kind,
			geography,
			code,
			name: (row.name as string | null) ?? code,
			boundaryReleases:
				releases === "" ? [] : releases.split(",").map(Number),
			...rest,
		};
	};

/**
 * A name's labels: positions packed as u32s, twice the place's position plus
 * 1 when reached by setting a title aside, or JSON where a label has text.
 */
const packLabels = (labels: CompiledPlaceLabel[]) =>
	labels.every((label) => label.length === 2)
		? packPositions(
				labels.map(([position, viaTitle]) => position * 2 + viaTitle),
			)
		: JSON.stringify(labels);

const unpackLabels = (value: SQLInputValue): CompiledPlaceLabel[] =>
	typeof value === "string"
		? (JSON.parse(value) as CompiledPlaceLabel[])
		: unpackPositions(value).map((packed) => [
				packed >>> 1,
				(packed & 1) as 0 | 1,
			]);

export const placeIndexTables = (
	index: PlaceIndexArtifact,
): Record<string, SqliteTable> => {
	const geographies = [
		...new Set(index.places.map((place) => place.geography)),
	].sort(compareCodeUnits);
	const geographyAt = new Map(
		geographies.map((geography, at) => [geography, at]),
	);
	const meta = {
		schemaVersion: String(index.schemaVersion),
		contentHash: index.contentHash,
		nameNormalisation: index.nameNormalisation,
		areaInventoryHash: index.areaInventoryHash,
		namedLocationInventoryHash: JSON.stringify(
			index.namedLocationInventoryHash,
		),
		releases: JSON.stringify(index.releases),
		geographies: JSON.stringify(geographies),
	};
	return {
		place_index_meta: {
			columns: ["key TEXT NOT NULL", "value TEXT NOT NULL"],
			key: ["key"],
			rows: Object.entries(meta),
		},
		place_index_places: {
			columns: [
				"geography INTEGER",
				"code TEXT",
				"name TEXT",
				"releases TEXT",
				"extra TEXT",
			],
			rows: index.places.map((place) => placeColumns(place, geographyAt)),
		},
		place_index_names: {
			columns: ["name TEXT", "labels"],
			rows: index.names.map((name, at) => [
				name,
				packLabels(index.labels[at]!),
			]),
		},
		place_index_codes: {
			columns: ["code TEXT", "places BLOB"],
			rows: index.codes.map((code, at) => [
				code,
				packPositions(index.codePlaces[at]!),
			]),
		},
	};
};

/**
 * The index stored in the shared atlas database, refused unless built from
 * this area inventory and these named locations.
 */
export const openPlaceIndexDatabase = (
	path: string,
	areaInventoryHash: string,
	namedLocations: NamedLocationInventory | undefined,
): PlaceIndex & { contentHash: string } => {
	const database = new SqliteIndex(path, "place_index_");
	const meta = (key: string) => database.meta.get(key) ?? "";
	const header: PlaceIndexHeader = {
		schemaVersion: Number(meta("schemaVersion")) as 1,
		contentHash: meta("contentHash"),
		nameNormalisation: meta("nameNormalisation"),
		areaInventoryHash: meta("areaInventoryHash"),
		namedLocationInventoryHash: JSON.parse(
			meta("namedLocationInventoryHash") || "null",
		),
	};
	const mismatch = headerMismatch(header, areaInventoryHash, namedLocations);
	if (mismatch) throw new Error(`The place index at ${path} ${mismatch}.`);
	const places = database.table("places");
	const names = database.table("names");
	const codes = database.table("codes");
	return {
		contentHash: header.contentHash,
		releases: JSON.parse(meta("releases")) as string[],
		places: places.records(
			placeFromColumns(JSON.parse(meta("geographies")) as string[]),
		),
		names: names.column("name", text),
		labels: names.column("labels", unpackLabels),
		codes: codes.column("code", text),
		codePlaces: codes.column("places", unpackPositions),
	};
};
