import {
	seriesKey,
	type StatisticsSource,
	type StatisticsMeasure,
	type StatisticsDimension,
	type StatisticsPeriod,
	type StatisticsSeries,
	type StatisticsDataset,
} from "@uk-data-atlas/atlas-runtime/catalogue";

const same = (a: unknown, b: unknown) =>
	JSON.stringify(a) === JSON.stringify(b);

/** Assign integer ids to text keys, refusing a key declared twice differently. */
class Registry<T> {
	readonly items: T[] = [];
	private readonly ids = new Map<string, number>();
	private readonly kind: string;
	constructor(kind: string) {
		this.kind = kind;
	}
	add(key: string, item: T) {
		const id = this.ids.get(key);
		if (id !== undefined) {
			if (!same(this.items[id - 1], item))
				throw new Error(`Conflicting ${this.kind} ${key}`);
			return id;
		}
		this.items.push(item);
		this.ids.set(key, this.items.length);
		return this.items.length;
	}
	id(key: string, context: string) {
		const id = this.ids.get(key);
		if (id === undefined)
			throw new Error(`Unknown ${this.kind} ${key} in ${context}`);
		return id;
	}
}

export const sourceKey = (source: StatisticsSource) =>
	JSON.stringify([source.publisher, source.url, source.licence]);

/** Assign ids to everything the datasets declare, refusing conflicts. */
export function registerStatistics(datasets: readonly StatisticsDataset[]) {
	const sources = new Registry<StatisticsSource>("source");
	const measures = new Registry<StatisticsMeasure>("measure");
	const dimensions = new Registry<Omit<StatisticsDimension, "members">>(
		"dimension",
	);
	const members = new Registry<{
		dimension: number;
		code: string;
		label: string;
		parent: number | null;
		position: number;
	}>("dimension member");
	const periods = new Registry<StatisticsPeriod>("period");
	const slugs = new Set<string>();
	const seriesKeys = new Set<string>();
	const seriesIds: number[][] = [];
	const seriesRows: {
		dataset: number;
		series: StatisticsSeries;
		key: string;
	}[] = [];

	for (const [index, dataset] of datasets.entries()) {
		if (slugs.has(dataset.slug))
			throw new Error(`Duplicate dataset ${dataset.slug}`);
		slugs.add(dataset.slug);
		const context = `dataset ${dataset.slug}`;
		sources.add(sourceKey(dataset.source), dataset.source);
		for (const measure of dataset.measures) {
			for (const reference of [measure.numerator, measure.denominator])
				if (reference !== undefined) measures.id(reference, context);
			measures.add(measure.slug, measure);
		}
		for (const { members: list, ...dimension } of dataset.dimensions ??
			[]) {
			const dimensionId = dimensions.add(dimension.slug, dimension);
			for (const [position, member] of list.entries())
				members.add(`${dimension.slug}\0${member.code}`, {
					dimension: dimensionId,
					code: member.code,
					label: member.label,
					parent:
						member.parent === undefined
							? null
							: members.id(
									`${dimension.slug}\0${member.parent}`,
									context,
								),
					position,
				});
		}
		if (dataset.categoryDimension !== undefined)
			dimensions.id(dataset.categoryDimension, context);
		for (const period of dataset.periods) periods.add(period.label, period);
		seriesIds.push(
			dataset.series.map((series, position) => {
				const key = seriesKey(dataset.slug, series);
				if (seriesKeys.has(key))
					throw new Error(`Duplicate series ${key}`);
				seriesKeys.add(key);
				measures.id(series.measure, context);
				for (const [dimension, member] of Object.entries(
					series.members ?? {},
				))
					members.id(`${dimension}\0${member}`, context);
				if (
					(series.method ?? "published") === "published" &&
					series.derivedFrom !== undefined
				)
					throw new Error(
						`Published series ${key} cannot be derived`,
					);
				if (
					series.derivedFrom !== undefined &&
					!(series.derivedFrom >= 0 && series.derivedFrom < position)
				)
					throw new Error(
						`Series ${key} derives from a later series`,
					);
				seriesRows.push({ dataset: index + 1, series, key });
				return seriesRows.length;
			}),
		);
	}
	const category = (dataset: StatisticsDataset, code: string | undefined) => {
		if (code === undefined) return null;
		if (dataset.categoryDimension === undefined)
			throw new Error(
				`Dataset ${dataset.slug} has categories but no categoryDimension`,
			);
		return members.id(
			`${dataset.categoryDimension}\0${code}`,
			dataset.slug,
		);
	};
	return {
		datasets,
		sources,
		measures,
		dimensions,
		members,
		periods,
		seriesIds,
		seriesRows,
		category,
	};
}
