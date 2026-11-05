import {
	totalMember,
	measureSeriesKey,
	type DataCatalog,
	type DimensionMemberDefinition,
	type Measure,
} from "@uk-data-atlas/measures";
import type { MeasureDimensions } from "./measureDimensionsLoader.ts";

/**
 * The API's measures: each catalogue measure id is one series of a measure,
 * with some of the measure's dimensions fixed. `crime-burglary` is the series
 * of `recorded-crimes` with `offence=burglary`. Routes still read series by
 * their catalogue id; this module is how a request names one by measure and
 * members instead.
 */

export type DimensionMember = {
	code: string;
	label: string;
	/** The nearest member this one is part of that is also served. */
	parent?: string;
};

export type Dimension = {
	id: string;
	label: string;
	/** The member every other is part of, used when a request names none. */
	total?: string;
	members: DimensionMember[];
};

export type Series = {
	/** Canonical identity of the measure, members and optional dataset. */
	id: string;
	catalogueMeasure: Measure;
	dimensions: Record<string, string>;
	/** Set where the dataset tells two series of one measure apart. */
	datasetId?: string;
};

export type DimensionalMeasure = {
	id: string;
	label: string;
	description: string;
	dimensions: Dimension[];
	series: Series[];
	/** Members chosen when a request names none and no one total applies. */
	defaults: Record<string, string>;
};

export type DimensionCatalogue = {
	measures: DimensionalMeasure[];
	measure: (id: string) => DimensionalMeasure | undefined;
	/** The measure and series a catalogue measure id names. */
	series: (
		catalogueId: string,
	) => { measure: DimensionalMeasure; series: Series } | undefined;
	/** Every dimension id, which is also its query parameter name. */
	dimensionIds: ReadonlySet<string>;
};

const byCatalogue = new WeakMap<DataCatalog, DimensionCatalogue>();

/** Members in the vocabulary's order, each parent the nearest served one. */
const servedMembers = (
	all: DimensionMemberDefinition[],
	served: Set<string>,
): DimensionMember[] => {
	const byCode = new Map(all.map((member) => [member.code, member]));
	const servedParent = (member: DimensionMemberDefinition) => {
		let parent = member.parent;
		const seen = new Set<string>();
		while (parent && !served.has(parent) && !seen.has(parent)) {
			seen.add(parent);
			parent = byCode.get(parent)?.parent;
		}
		return parent && served.has(parent) ? parent : undefined;
	};
	return all
		.filter((member) => served.has(member.code))
		.map((member) => {
			const parent = servedParent(member);
			return {
				code: member.code,
				label: member.label,
				...(parent ? { parent } : {}),
			};
		});
};

/** The dimensional view of a catalogue, built once per catalogue. */
export const dimensionCatalogue = (
	catalog: DataCatalog,
	{ config, vocabulary }: MeasureDimensions,
): DimensionCatalogue => {
	const cached = byCatalogue.get(catalog);
	if (cached) return cached;
	const grouped = new Map<string, Series[]>();
	for (const measure of catalog.measures) {
		const mapping = config.ids[measure.id];
		if (!mapping) continue;
		const series: Series = {
			id: measureSeriesKey(mapping),
			catalogueMeasure: measure,
			dimensions: mapping.dimensions ?? {},
			...(mapping.datasetId ? { datasetId: mapping.datasetId } : {}),
		};
		grouped.set(mapping.measure, [
			...(grouped.get(mapping.measure) ?? []),
			series,
		]);
	}
	const measures: DimensionalMeasure[] = [...grouped].map(([id, series]) => {
		const definition = vocabulary.measures[id] ?? config.measures[id]!;
		const dimensionIds = [
			...new Set(
				series.flatMap((entry) => Object.keys(entry.dimensions)),
			),
		];
		const dimensions = dimensionIds.map((dimension): Dimension => {
			const held = vocabulary.dimensions[dimension];
			const all = [
				...(held?.members ??
					config.dimensions[dimension]?.members ??
					[]),
				...(config.members[dimension] ?? []),
			];
			const members = servedMembers(
				all,
				new Set(series.map((entry) => entry.dimensions[dimension]!)),
			);
			const total = totalMember(members);
			return {
				id: dimension,
				label: held?.label ?? config.dimensions[dimension]!.label,
				...(total ? { total } : {}),
				members,
			};
		});
		return {
			id,
			label: definition.label,
			description: definition.description,
			dimensions,
			series,
			defaults: config.defaults[id] ?? {},
		};
	});
	const measureIndex = new Map(
		measures.map((measure) => [measure.id, measure]),
	);
	const seriesIndex = new Map(
		measures.flatMap((measure) =>
			measure.series.map(
				(series) =>
					[series.catalogueMeasure.id, { measure, series }] as const,
			),
		),
	);
	const built: DimensionCatalogue = {
		measures,
		measure: (id) => measureIndex.get(id),
		series: (catalogueId) => seriesIndex.get(catalogueId),
		dimensionIds: new Set(
			measures.flatMap((measure) =>
				measure.dimensions.map((dimension) => dimension.id),
			),
		),
	};
	byCatalogue.set(catalog, built);
	return built;
};

const identities = new WeakMap<DataCatalog, MeasureDimensions>();

/**
 * Each catalogue measure as a measure of its own with no dimensions, for a
 * server started without the reviewed mapping, such as a test fixture.
 */
export const identityDimensions = (catalog: DataCatalog): MeasureDimensions => {
	const cached = identities.get(catalog);
	if (cached) return cached;
	const built: MeasureDimensions = {
		vocabulary: { schemaVersion: 1, measures: {}, dimensions: {} },
		config: {
			schemaVersion: 1,
			measures: Object.fromEntries(
				catalog.measures.map((measure) => [
					measure.id,
					{
						label: measure.label,
						description: measure.label,
						reason: "",
					},
				]),
			),
			dimensions: {},
			members: {},
			defaults: {},
			ids: Object.fromEntries(
				catalog.measures.map((measure) => [
					measure.id,
					{ measure: measure.id },
				]),
			),
		},
	};
	identities.set(catalog, built);
	return built;
};

/** A series' members, with their labels, in the measure's dimension order. */
export const describeMembers = (
	measure: DimensionalMeasure,
	members: Record<string, string>,
): Record<string, { member: string; label: string; defaulted?: true }> =>
	Object.fromEntries(
		measure.dimensions
			.filter((dimension) => dimension.id in members)
			.map((dimension) => {
				const code = members[dimension.id]!;
				const member = dimension.members.find(
					(candidate) => candidate.code === code,
				);
				return [
					dimension.id,
					{ member: code, label: member?.label ?? code },
				];
			}),
	);

/**
 * A catalogue measure id as the public measure and members it is read as, for
 * a response that would otherwise name a series by its internal id.
 */
export const publicSeries = (
	catalog: DataCatalog,
	dimensions: MeasureDimensions | undefined,
	id: string,
): { id: string; dimensions: Record<string, string> } => {
	const found = dimensionCatalogue(
		catalog,
		dimensions ?? identityDimensions(catalog),
	).series(id);
	return found
		? { id: found.measure.id, dimensions: found.series.dimensions }
		: { id, dimensions: {} };
};
