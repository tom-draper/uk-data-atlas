import type { AreaLookup } from "@uk-data-atlas/areas";
import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
import type { NamedLocationInventory } from "@uk-data-atlas/places";
import { compareBoundaryReleases } from "@uk-data-atlas/catalogue";
import { NAME_NORMALISATION } from "@uk-data-atlas/search-index/node";
import { normalisePlaceName, withoutTitle } from "@uk-data-atlas/geography";
import { compareCodeUnits } from "@uk-data-atlas/search-index";
import { sha256 } from "@uk-data-atlas/artifacts";
import type { SQLInputValue } from "node:sqlite";
import {
	SqliteIndex,
	text,
	unpackPositions,
	type Row,
} from "@uk-data-atlas/atlas-db";

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

import {
	AREA_CODE,
	placeReference,
	type CompiledPlace,
	type CompiledPlaceLabel,
	type PlaceIndex,
	type PlaceIndexArtifact,
} from "@uk-data-atlas/places";
export {
	AREA_CODE,
	placeReference,
	type CompiledPlace,
	type CompiledPlaceLabel,
	type PlaceIndex,
	type PlaceIndexArtifact,
} from "@uk-data-atlas/places";

/** The fields an index is checked against before it serves a query. */
type PlaceIndexHeader = Pick<
	PlaceIndexArtifact,
	| "schemaVersion"
	| "contentHash"
	| "nameNormalisation"
	| "areaInventoryHash"
	| "namedLocationInventoryHash"
>;

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
const unpackLabels = (value: SQLInputValue): CompiledPlaceLabel[] =>
	typeof value === "string"
		? (JSON.parse(value) as CompiledPlaceLabel[])
		: unpackPositions(value).map((packed) => [
				packed >>> 1,
				(packed & 1) as 0 | 1,
			]);

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
	const places = database.table("place");
	const names = database.table("name");
	const codes = database.table("code");
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
