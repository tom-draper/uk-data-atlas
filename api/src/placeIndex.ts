import { createHash } from "node:crypto";
import type { AreaLookup } from "./areaInventory";
import type { NamedLocationInventory } from "./namedLocations";
import {
	NAME_NORMALISATION,
	normalisePlaceName,
	withoutTitle,
} from "./nameNormalisation";
import { compareCodeUnits } from "./sortedIndex";

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

/** The shape of a code a query can name directly: E08000003. */
export const AREA_CODE = /^[A-Z]\d{8}$/;

export const placeReference = (
	kind: "area" | "named-location",
	geography: string,
	code: string,
) => (kind === "named-location" ? `location/${code}` : `${geography}/${code}`);

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

type Grouped = Omit<CompiledPlace, "name" | "boundaryReleases"> & {
	/** Release to name, so the newest release's name wins. */
	names: Map<string, string>;
	boundaryReleases: Set<string>;
};

type Label = { place: string; label: string; viaTitle: boolean };

export const compilePlaceIndex = (
	areaLookup: AreaLookup,
	namedLocations: NamedLocationInventory | undefined,
	areaInventoryHash: string,
): PlaceIndexArtifact => {
	const grouped = new Map<string, Grouped>();
	const byName = new Map<string, Label[]>();
	const add = (name: string, entry: Label) => {
		const list = byName.get(name);
		if (!list) {
			byName.set(name, [entry]);
			return;
		}
		// The same code carries the same name in release after release; one
		// entry per place and label is enough.
		if (
			!list.some(
				(existing) =>
					existing.place === entry.place &&
					existing.label === entry.label,
			)
		) {
			list.push(entry);
		}
	};
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
		.sort()
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
				...(place.memberGeography
					? { memberGeography: place.memberGeography }
					: {}),
				...(place.definitionRevision
					? { definitionRevision: place.definitionRevision }
					: {}),
				...(place.validity ? { validity: place.validity } : {}),
			};
		});
	const position = new Map(
		places.map((place, index) => [place.place, index]),
	);

	const names = [...byName.keys()].sort(compareCodeUnits);
	const labels = names.map((name) =>
		byName.get(name)!.map((entry): CompiledPlaceLabel => {
			const index = position.get(entry.place)!;
			const viaTitle = entry.viaTitle ? 1 : 0;
			return entry.label === places[index]!.name
				? [index, viaTitle]
				: [index, viaTitle, entry.label];
		}),
	);

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
