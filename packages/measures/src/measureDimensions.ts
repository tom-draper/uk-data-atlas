import type { DataCatalog } from "./dataCatalog";

/**
 * Measures and their dimensions, and how each catalogue measure id maps onto
 * them.
 *
 * A catalogue measure id such as `crime-burglary` names one series: a measure
 * (`recorded-crimes`) with some of its dimensions fixed (`offence=burglary`).
 * The statistics tables already model that; the vocabulary below is generated
 * from them, and `services/api/config/measure-dimensions.json` maps every
 * catalogue id onto it. The data catalogue build refuses an id with no
 * mapping, so a new encoded id cannot be published by accident.
 */

export type DimensionMemberDefinition = {
	code: string;
	label: string;
	/** The member this one is part of, such as `theft` for `burglary`. */
	parent?: string;
};

export type MeasureDefinition = {
	label: string;
	description: string;
};

export type DimensionDefinition = {
	label: string;
	members: DimensionMemberDefinition[];
};

/**
 * The measures and dimensions the statistics tables hold, written by
 * `pnpm --dir services/api generate:statistics-vocabulary` from `atlas.sqlite`.
 */
export type StatisticsVocabulary = {
	schemaVersion: 1;
	measures: Record<
		string,
		MeasureDefinition & {
			unit: string;
			valueKind: string;
			aggregation: string;
		}
	>;
	dimensions: Record<string, DimensionDefinition>;
};

/** What one catalogue measure id stands for. */
export type MeasureIdMapping = {
	measure: string;
	/** Fixed members, by dimension. Absent when the measure has no breakdown. */
	dimensions?: Record<string, string>;
	/**
	 * The dataset, where the measure and members alone do not tell two ids
	 * apart: general and local election votes are both `party-votes`.
	 */
	datasetId?: string;
};

/** The reviewed mapping, `services/api/config/measure-dimensions.json`. */
export type MeasureDimensionsConfig = {
	schemaVersion: 1;
	/** Measures the API serves that the statistics tables do not hold yet. */
	measures: Record<string, MeasureDefinition & { reason: string }>;
	/** Dimensions the API serves that the statistics tables do not hold yet. */
	dimensions: Record<string, DimensionDefinition & { reason: string }>;
	/** Members the API serves for a dimension the statistics tables hold. */
	members: Record<string, DimensionMemberDefinition[]>;
	/**
	 * The members chosen when a request names none and the measure's series
	 * have no one total in common, such as households counted by tenure and
	 * by car availability.
	 */
	defaults: Record<string, Record<string, string>>;
	ids: Record<string, MeasureIdMapping>;
};

/** A dimension's members, from the statistics tables and the reviewed config. */
export const dimensionMembers = (
	dimension: string,
	config: MeasureDimensionsConfig,
	vocabulary: StatisticsVocabulary,
): DimensionMemberDefinition[] => [
	...(vocabulary.dimensions[dimension]?.members ??
		config.dimensions[dimension]?.members ??
		[]),
	...(config.members[dimension] ?? []),
];

/** The member every other member is part of, where there is exactly one. */
export const totalMember = (members: DimensionMemberDefinition[]) => {
	const byCode = new Map(members.map((member) => [member.code, member]));
	const rootOf = (member: DimensionMemberDefinition): string => {
		const seen = new Set<string>();
		let current = member;
		while (current.parent && byCode.has(current.parent)) {
			if (seen.has(current.code)) return current.code;
			seen.add(current.code);
			current = byCode.get(current.parent)!;
		}
		return current.code;
	};
	const roots = new Set(members.map(rootOf));
	return roots.size === 1 && members.length > 1 ? [...roots][0] : undefined;
};

const key = (mapping: MeasureIdMapping) =>
	JSON.stringify([
		mapping.measure,
		Object.entries(mapping.dimensions ?? {}).sort(([left], [right]) =>
			left.localeCompare(right),
		),
		mapping.datasetId ?? null,
	]);

/** Everything wrong with a mapping, against a catalogue and the vocabulary. */
export const measureDimensionProblems = (
	catalog: Pick<DataCatalog, "measures">,
	config: MeasureDimensionsConfig,
	vocabulary: StatisticsVocabulary,
): string[] => {
	const problems: string[] = [];
	const catalogued = new Map(
		catalog.measures.map((measure) => [measure.id, measure]),
	);
	const isMeasure = (slug: string) =>
		slug in vocabulary.measures || slug in config.measures;
	for (const slug of Object.keys(config.measures))
		if (slug in vocabulary.measures)
			problems.push(
				`Measure ${slug} is in the statistics tables, so it needs no entry in measures.`,
			);
	for (const slug of Object.keys(config.dimensions))
		if (slug in vocabulary.dimensions)
			problems.push(
				`Dimension ${slug} is in the statistics tables, so it needs no entry in dimensions.`,
			);
	for (const [dimension, members] of Object.entries(config.members)) {
		const held = vocabulary.dimensions[dimension];
		if (!held) {
			problems.push(
				`Members are added to ${dimension}, which is not a dimension in the statistics tables.`,
			);
			continue;
		}
		const codes = new Set(held.members.map((member) => member.code));
		for (const member of members) {
			if (codes.has(member.code))
				problems.push(
					`Member ${dimension}=${member.code} is already in the statistics tables.`,
				);
			codes.add(member.code);
		}
		for (const member of members)
			if (member.parent && !codes.has(member.parent))
				problems.push(
					`Member ${dimension}=${member.code} names an unknown parent ${member.parent}.`,
				);
	}
	for (const measure of catalog.measures)
		if (!config.ids[measure.id])
			problems.push(
				`Measure id ${measure.id} has no mapping to a measure and its dimension members.`,
			);
	const seen = new Map<string, string>();
	for (const [id, mapping] of Object.entries(config.ids)) {
		const measure = catalogued.get(id);
		if (!measure) {
			problems.push(`Mapped id ${id} is not a catalogue measure.`);
			continue;
		}
		if (!isMeasure(mapping.measure))
			problems.push(
				`${id} maps to an unknown measure ${mapping.measure}.`,
			);
		if (isMeasure(id) && mapping.measure !== id)
			problems.push(
				`${id} is a measure's own id, so it must map to that measure, not ${mapping.measure}.`,
			);
		for (const alias of measure.aliases ?? [])
			if (isMeasure(alias) && alias !== mapping.measure)
				problems.push(
					`${id}'s alias ${alias} is another measure's id.`,
				);
		for (const [dimension, code] of Object.entries(
			mapping.dimensions ?? {},
		)) {
			const members = dimensionMembers(dimension, config, vocabulary);
			if (members.length === 0)
				problems.push(`${id} names an unknown dimension ${dimension}.`);
			else if (!members.some((member) => member.code === code))
				problems.push(
					`${id} names an unknown member ${dimension}=${code}.`,
				);
		}
		if (
			mapping.datasetId !== undefined &&
			!measure.sources.some(
				(source) => source.datasetId === mapping.datasetId,
			)
		)
			problems.push(
				`${id} names dataset ${mapping.datasetId}, which none of its sources is from.`,
			);
		const identity = key(mapping);
		const other = seen.get(identity);
		if (other)
			problems.push(
				`${other} and ${id} map to the same measure and members; give each a datasetId or a member that tells them apart.`,
			);
		seen.set(identity, id);
	}
	for (const [measure, members] of Object.entries(config.defaults)) {
		if (!isMeasure(measure))
			problems.push(
				`Defaults are given for an unknown measure ${measure}.`,
			);
		for (const [dimension, code] of Object.entries(members))
			if (
				!dimensionMembers(dimension, config, vocabulary).some(
					(member) => member.code === code,
				)
			)
				problems.push(
					`The default ${dimension}=${code} for ${measure} is not a member.`,
				);
	}
	return problems;
};

/** Refuse a catalogue whose measure ids are not all mapped. */
export const assertMeasureDimensions = (
	catalog: Pick<DataCatalog, "measures">,
	config: MeasureDimensionsConfig,
	vocabulary: StatisticsVocabulary,
) => {
	const problems = measureDimensionProblems(catalog, config, vocabulary);
	if (problems.length > 0)
		throw new Error(
			`The measure dimension mapping does not match the catalogue:\n${problems.join("\n")}\nEdit services/api/config/measure-dimensions.json.`,
		);
};
