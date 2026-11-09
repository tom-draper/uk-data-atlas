import type { IdRegistries } from "../ids/idRegistries.ts";
import type { IdRegistry } from "../ids/idRegistry.ts";
import {
	type StatisticsSource,
	type StatisticsMeasure,
	type StatisticsDimension,
	type StatisticsPeriod,
} from "@uk-data-atlas/measures";
import {
	seriesKey,
	type StatisticsSeries,
	type StatisticsDataset,
} from "@uk-data-atlas/measures";

const same = (a: unknown, b: unknown) =>
	JSON.stringify(a) === JSON.stringify(b);

/**
 * Give text keys their ids from a stable registry, refusing a key declared
 * twice differently. Ids are the registry's, so they follow neither the order
 * of the declarations nor how many there are: `entries` are in declaration
 * order and need not be in id order.
 */
class Registry<T> {
	readonly entries: { id: number; item: T }[] = [];
	private readonly ids = new Map<string, number>();
	private readonly items = new Map<number, T>();
	private readonly kind: string;
	private readonly stable: IdRegistry;
	private readonly fields: (key: string) => string[];
	constructor(
		kind: string,
		stable: IdRegistry,
		fields: (key: string) => string[] = (key) => [key],
	) {
		this.kind = kind;
		this.stable = stable;
		this.fields = fields;
	}
	add(key: string, item: T) {
		const id = this.ids.get(key);
		if (id !== undefined) {
			if (!same(this.items.get(id), item))
				throw new Error(`Conflicting ${this.kind} ${key}`);
			return id;
		}
		const assigned = this.stable.assign(...this.fields(key));
		this.entries.push({ id: assigned, item });
		this.items.set(assigned, item);
		this.ids.set(key, assigned);
		return assigned;
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
export function registerStatistics(
	datasets: readonly StatisticsDataset[],
	ids: IdRegistries,
) {
	const sources = new Registry<StatisticsSource>("source", ids.source);
	const measures = new Registry<StatisticsMeasure>("measure", ids.measure);
	const dimensions = new Registry<Omit<StatisticsDimension, "members">>(
		"dimension",
		ids.dimension,
	);
	const members = new Registry<{
		dimension: number;
		code: string;
		label: string;
		parent: number | null;
		position: number;
	}>("dimension member", ids.dimensionMember, (key) => key.split("\0"));
	const periods = new Registry<StatisticsPeriod>("period", ids.period);
	const slugs = new Set<string>();
	const seriesKeys = new Set<string>();
	/** Each dataset's id, in `datasets` order. */
	const datasetIds: number[] = [];
	const seriesIds: number[][] = [];
	const seriesRows: {
		/** The series' dataset's id, and its place in `datasets`. */
		dataset: number;
		datasetIndex: number;
		id: number;
		series: StatisticsSeries;
		key: string;
	}[] = [];

	for (const [index, dataset] of datasets.entries()) {
		if (slugs.has(dataset.slug))
			throw new Error(`Duplicate dataset ${dataset.slug}`);
		slugs.add(dataset.slug);
		const datasetId = ids.dataset.assign(dataset.slug);
		datasetIds.push(datasetId);
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
				const id = ids.series.assign(key);
				seriesRows.push({
					dataset: datasetId,
					datasetIndex: index,
					id,
					series,
					key,
				});
				return id;
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
		datasetIds,
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
