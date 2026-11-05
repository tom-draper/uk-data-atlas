import { PLACE_INDEX_CODES_VIEW, PLACE_INDEX_NAMES_VIEW, PLACE_INDEX_PLACES_VIEW } from "./deprecatedViews.ts";
import type { SqliteTable } from "@uk-data-atlas/artifacts";
import { compareCodeUnits, packPositions } from "@uk-data-atlas/search-index";
import {
	placeReference,
	type CompiledPlace,
	type CompiledPlaceLabel,
	type PlaceIndexArtifact,
} from "@uk-data-atlas/places";

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

const packLabels = (labels: CompiledPlaceLabel[]) =>
	labels.every((label) => label.length === 2)
		? packPositions(
				labels.map(([position, viaTitle]) => position * 2 + viaTitle),
			)
		: JSON.stringify(labels);

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
		place_index_place: {
			views: { place_index_places: PLACE_INDEX_PLACES_VIEW },
			columns: [
				"geography INTEGER",
				"code TEXT",
				"name TEXT",
				"releases TEXT",
				"extra TEXT",
			],
			rows: index.places.map((place) => placeColumns(place, geographyAt)),
		},
		place_index_name: {
			views: { place_index_names: PLACE_INDEX_NAMES_VIEW },
			columns: ["name TEXT", "labels"],
			rows: index.names.map((name, at) => [
				name,
				packLabels(index.labels[at]!),
			]),
		},
		place_index_code: {
			views: { place_index_codes: PLACE_INDEX_CODES_VIEW },
			columns: ["code TEXT", "places BLOB"],
			rows: index.codes.map((code, at) => [
				code,
				packPositions(index.codePlaces[at]!),
			]),
		},
	};
};
