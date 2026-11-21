import { DATASET_DECLARATIONS, themeOfTopic } from "@uk-data-atlas/datasets";
import type { DeclaredDatasetId } from "@uk-data-atlas/datasets";
import { definitionOf, type DatasetDeclaration } from "@uk-data-atlas/datasets";
import type {
	DatasetDisplay,
	DisplayField,
	DisplayFormat,
	DisplayMapView,
	DisplayRanking,
	DisplayMeasure,
} from "@uk-data-atlas/datasets";
import { getFeatureProp } from "@/lib/types";
import { createBoundaryAggregationSpec } from "@/lib/helpers/datasetAggregation/ports";
import { collectBoundaryRecords } from "@/lib/helpers/datasetAggregation/numeric";
import { formatCompactCount, formatCount } from "@/lib/helpers/formatCount";
import type { CatalogueDataset } from "@/lib/data/catalog";
import type { MapOptions } from "@/lib/types/mapOptions";
import type { ChartDatasetDefinition } from "./types.ts";
import type { BarsCardConfig } from "../measures/barsConfig.ts";
import type { DeprivationCardConfig } from "./deprivationCard.ts";
import type { BreakdownCardConfig } from "../measures/breakdownConfig.ts";
import type { SeriesCardConfig } from "../measures/seriesConfig.ts";
import { CATEGORY_CHART_DEFINITIONS } from "./categories.ts";
import { defineValueCard, type ValueCardConfig } from "./valueCard.ts";

/**
 * The website's reading of a dataset declaration: its chart card, map colours,
 * legend and measure choice come from the declaration's `display`, so a
 * dataset that fits needs no website code of its own.
 */

type Displayed = DatasetDeclaration & { display: DatasetDisplay };

const displayed = DATASET_DECLARATIONS.filter(
	(declaration): declaration is Displayed =>
		declaration.display !== undefined,
);

/** The component every declared card is drawn by. */
export const DECLARED_CHART_COMPONENT = "@/components/ValueCard";

/** A declared card's key: its theme, then its id, such as `economy-claimant-count`. */
export const declaredChartKey = (declaration: Displayed) =>
	`${themeOfTopic(declaration.topic)}-${declaration.id}`;

function formatCountValue(
	format: Extract<DisplayFormat, { kind: "count" }>,
	value: number,
) {
	const scaled = format.scale === undefined ? value : value * format.scale;
	if (format.digits !== undefined)
		return scaled.toLocaleString(format.locale, {
			minimumFractionDigits: format.digits,
			maximumFractionDigits: format.digits,
		});
	const whole = format.round ? Math.round(scaled) : scaled;
	return format.locale
		? whole.toLocaleString(format.locale)
		: formatCount(whole);
}

export function formatDisplay(format: DisplayFormat, value: number): string {
	switch (format.kind) {
		case "decimal":
			return `${format.prefix ?? ""}${value.toFixed(format.digits)}${format.suffix ?? ""}`;
		case "count":
			return `${format.prefix ?? ""}${formatCountValue(format, value)}${format.suffix ?? ""}`;
		case "compact":
			return `${formatCompactCount(value)}${format.suffix ?? ""}`;
		case "rank": {
			const rank = format.of + 1 - value;
			return rank <= 1
				? "Most deprived"
				: rank >= format.of
					? "Least deprived"
					: `Rank ${Math.round(rank).toLocaleString()}`;
		}
		case "millions":
			return `${format.prefix ?? ""}${
				value >= 1_000
					? `${(value / 1_000).toFixed(1)}bn`
					: `${value.toFixed(0)}m`
			}${format.suffix ?? ""}`;
		case "thousands":
			return `${format.prefix ?? ""}${Math.round(value / 1000)}k${format.suffix ?? ""}`;
	}
}

/** A dotted path into a record, or null where any step is missing. */
const read = (record: unknown, path: string): number | null => {
	let current: unknown = record;
	for (const key of path.split(".")) {
		if (current === null || typeof current !== "object") return null;
		current = (current as Record<string, unknown>)[key];
	}
	return typeof current === "number" ? current : null;
};

/** A measure's value in a record: a field, or one field as a percentage of another. */
const valueOf = (record: unknown, field: DisplayField): number | null => {
	if (typeof field === "string") return read(record, field);
	if ("mean" in field) {
		const values = field.mean.map((path) => read(record, path));
		return values.some((value) => value === null)
			? null
			: (values as number[]).reduce((sum, value) => sum + value, 0) /
					values.length;
	}
	if ("apportion" in field) {
		const { amount, part, whole } = field.apportion;
		const total = read(record, amount);
		const portion = read(record, part);
		const all = read(record, whole);
		if (total === null || portion === null || all === null) return null;
		return all > 0 ? (total * portion) / all : portion === 0 ? 0 : null;
	}
	const of = read(record, field.share.of);
	const over = read(record, field.share.over);
	return of === null || !over ? null : (of / over) * 100;
};

/** A dotted path into a record, whatever its type. */
const flag = (record: unknown, path: string): unknown => {
	let current: unknown = record;
	for (const key of path.split(".")) {
		if (current === null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[key];
	}
	return current;
};

const declarationFor = (type: string) =>
	displayed.find((declaration) => declaration.id === type);

/** The display of a declared dataset, or undefined for any other. */
export const declaredDisplay = (type: string): DatasetDisplay | undefined =>
	declarationFor(type)?.display;

const measureFor = (display: DatasetDisplay, id: string | undefined) =>
	display.measures.find((measure) => measure.id === id) ??
	display.measures[0];

/** The measure a visitor has chosen, or the default, for a declared dataset. */
export function declaredMeasure(
	type: string,
	options: MapOptions,
): DisplayMeasure | undefined {
	const display = declaredDisplay(type);
	if (!display) return undefined;
	const chosen = (
		options as Record<string, { measure?: string } | undefined>
	)[type]?.measure;
	return measureFor(display, chosen);
}

/** The initial map options of a declared dataset. */
export const declaredDefaultOptions = (type: string) => {
	const display = declaredDisplay(type);
	if (!display) return undefined;
	const [first] = display.measures;
	return { measure: first.id, colorRange: { ...first.colorRange } };
};

/** The views a dataset's map can show, the first being its default, if it declares any. */
export const declaredMapViews = (
	type: string,
): readonly DisplayMapView[] | undefined =>
	DATASET_DECLARATIONS.find((declaration) => declaration.id === type)
		?.mapViews;

/** The map view a link names, or the dataset's first when it names none or an unknown one. */
export const declaredMapView = (
	type: string,
	view: string | undefined,
): DisplayMapView | undefined => {
	const views = declaredMapViews(type);
	return views?.find(({ id }) => id === view) ?? views?.[0];
};

/** How a map's areas read in a ranking, if its dataset declares it. */
export const declaredRanking = (
	dataset: string,
	view: string | undefined,
): DisplayRanking | undefined => {
	const declaration = DATASET_DECLARATIONS.find(({ id }) => id === dataset);
	return (
		declaration?.mapViews?.find(({ id }) => id === view)?.ranking ??
		declaration?.ranking
	);
};

/** The initial colour range of every declared map view, by its options group. */
export const declaredMapViewOptions = () =>
	Object.fromEntries(
		DATASET_DECLARATIONS.flatMap(({ mapViews }) => mapViews ?? []).map(
			(view) => [view.optionsKey, { colorRange: { ...view.colorRange } }],
		),
	);

/** The record describing an area, reached through `recordsVia` when the dataset names one. */
const recordKey = (
	dataset: Record<string, unknown>,
	via: string | undefined,
	code: string,
): string | undefined =>
	via === undefined
		? code
		: (dataset[via] as Record<string, string> | undefined)?.[code];

const seriesFor = (
	declaration: Displayed,
	series: NonNullable<DatasetDisplay["series"]>,
	measureId: string,
): SeriesCardConfig => {
	const measure =
		series.measures[measureId] ?? Object.values(series.measures)[0]!;
	const countMeasure = series.countOf?.[measure];
	return {
		request: {
			measure,
			datasetId: series.release?.datasetId ?? declaration.id,
			geography: series.release?.geography ?? declaration.boundary.type,
			boundaryYear:
				series.release?.boundaryYear ?? declaration.boundary.year,
		},
		...(countMeasure ? { countMeasure } : {}),
		...(series.combine ? { combine: series.combine } : {}),
		heading: series.headings?.[measureId] ?? series.heading,
		period: series.period,
		source: series.source,
		accent: series.accent,
		line: series.line ?? series.accent,
	};
};

const breakdownFor = (
	declaration: Displayed,
	breakdown: NonNullable<DatasetDisplay["breakdown"]>,
): BreakdownCardConfig => ({
	request: {
		measure: breakdown.measure,
		datasetId: declaration.id,
		geography: declaration.boundary.type,
		boundaryYear: declaration.boundary.year,
	},
	dimension: breakdown.dimension,
	total: breakdown.total,
	parts: breakdown.parts,
	accent: breakdown.accent,
	order: breakdown.order,
	heading: breakdown.heading,
	period: breakdown.period,
	source: breakdown.source,
	coverage: breakdown.coverage,
});

const deprivationFor = (
	declaration: Displayed,
	deprivation: NonNullable<DatasetDisplay["deprivation"]>,
): DeprivationCardConfig => ({
	...deprivation,
	datasetType: declaration.id as DeprivationCardConfig["datasetType"],
	headlineMeasure: declaration.display.measures[0].id,
});

const barsFor = (
	declaration: Displayed,
	bars: NonNullable<DatasetDisplay["bars"]>,
): BarsCardConfig => ({
	request: {
		datasetId: bars.release?.datasetId ?? declaration.id,
		geography: bars.release?.geography ?? declaration.boundary.type,
		boundaryYear: bars.release?.boundaryYear ?? declaration.boundary.year,
	},
	measures: bars.measures,
	...(bars.views ? { views: bars.views } : {}),
	dimension: bars.dimension,
	bars: bars.bars,
	combine: bars.combine,
	ramp: bars.ramp,
	digits: bars.digits,
	heading: bars.heading,
});

const cardFor = (
	declaration: Displayed,
	measure: DisplayMeasure,
): ValueCardConfig | undefined => {
	const { card, recordsVia } = declaration.display;
	if (!card) return undefined;
	if (!measure.card)
		throw new Error(
			`${declaration.id} draws a card but measure ${measure.id} declares none`,
		);
	const secondary = measure.card.secondary ?? card.secondary;
	return defineValueCard<
		{ data: Record<string, Record<string, unknown>> },
		Record<string, unknown>
	>({
		heading: measure.card.heading ?? card.heading,
		...((measure.card.period ?? card.period)
			? { period: (measure.card.period ?? card.period)! }
			: {}),
		source: card.source,
		...(card.coverage ? { coverage: card.coverage } : {}),
		...card.appearance,
		unit: measure.card.unit,
		...(measure.card.prefix ? { prefix: measure.card.prefix } : {}),
		...(card.hoverRecord ? { hoverRecord: true } : {}),
		...(card.summariseLsoas
			? {
					combineLsoas: declaration.display.aggregation.aggregate as (
						records: Record<string, unknown>[],
					) => Record<string, unknown> | null,
				}
			: {}),
		...(measure.card.digits === undefined
			? {}
			: { digits: measure.card.digits }),
		...(measure.card.format
			? {
					format: (value: number) =>
						formatDisplay(measure.card!.format!, value),
				}
			: {}),
		maximum: measure.card.maximum,
		...(card.pills
			? {
					pills: (record: Record<string, unknown>) =>
						card.pills!.map((pill) => ({
							label: pill.label,
							value: read(record, pill.field),
							unit: pill.unit,
							digits: pill.digits,
						})),
				}
			: {}),
		...(recordsVia
			? {
					lookup: (
						dataset: Record<string, unknown>,
						code: string,
					) => {
						const key = recordKey(dataset, recordsVia, code);
						return key === undefined
							? undefined
							: (
									dataset.data as Record<
										string,
										Record<string, unknown>
									>
								)[key];
					},
				}
			: {}),
		value: (record) => {
			const value = valueOf(record, measure.card?.field ?? measure.field);
			return measure.card?.zeroIsMissing && value === 0 ? null : value;
		},
		...(secondary
			? {
					secondary: (record) => {
						const value = read(record, secondary.field);
						if (value === null) return undefined;
						if (secondary.versus === undefined)
							return formatDisplay(secondary.format, value);
						const other = read(record, secondary.versus);
						return other === null
							? undefined
							: `${formatDisplay(secondary.format, value)} vs ${formatDisplay(secondary.format, other)}`;
					},
				}
			: (measure.card.note ?? card.secondaryText)
				? {
						secondary: (record) =>
							card.secondaryHiddenWhen &&
							flag(record, card.secondaryHiddenWhen) === true
								? undefined
								: (measure.card!.note ?? card.secondaryText),
					}
				: {}),
	});
};

const chartDefinitionOf = (declaration: Displayed): ChartDatasetDefinition => {
	const { display } = declaration;
	const [first] = display.measures;
	const { recordsVia } = display;
	const aggregate = display.aggregation.aggregate as (
		records: unknown[],
	) => unknown;
	const aggregation = createBoundaryAggregationSpec(
		declaration.id,
		display.aggregation.scope,
		recordsVia
			? // Over the whole dataset: each record counts once however many
				// areas map to it.
				(features, codeProp, dataset: Record<string, unknown>) => {
					const data = dataset.data as Record<string, unknown>;
					const keys = new Set<string>();
					for (const feature of features) {
						const key = recordKey(
							dataset,
							recordsVia,
							getFeatureProp(feature.properties, codeProp) ?? "",
						);
						if (key !== undefined && key in data) keys.add(key);
					}
					return aggregate([...keys].map((key) => data[key]));
				}
			: (features, codeProp, data: Record<string, unknown>) =>
					aggregate(
						collectBoundaryRecords(
							features,
							data,
							codeProp,
							display.aggregation.distinct,
						),
					),
	);
	const optionsOf = (options: MapOptions) =>
		measureFor(
			display,
			(options as Record<string, { measure?: string } | undefined>)[
				declaration.id
			]?.measure,
		);
	// One card per measure, so a card's functions keep their identity across
	// renders and the value card's per-authority cache can hit.
	const cards = new Map<DisplayMeasure, ValueCardConfig | undefined>();
	const cardOf = (measure: DisplayMeasure) => {
		if (!cards.has(measure))
			cards.set(measure, cardFor(declaration, measure));
		return cards.get(measure);
	};
	return {
		...definitionOf(declaration),
		chart: {
			topic: declaration.topic,
			key: declaredChartKey(declaration),
			label: display.label,
			componentPath: display.component ?? DECLARED_CHART_COMPONENT,
			...(display.card
				? {
						card: cardOf(
							measureFor(display, display.card.fixedMeasure),
						),
						cardForOptions: (options: MapOptions) =>
							cardOf(
								display.card?.fixedMeasure
									? measureFor(
											display,
											display.card.fixedMeasure,
										)
									: optionsOf(options),
							)!,
					}
				: {}),
			...(display.series
				? {
						seriesForOptions: (options: MapOptions) =>
							seriesFor(
								declaration,
								display.series!,
								optionsOf(options).id,
							),
					}
				: {}),
			...(display.breakdown
				? { breakdown: breakdownFor(declaration, display.breakdown) }
				: {}),
			...(display.deprivation
				? {
						deprivation: deprivationFor(
							declaration,
							display.deprivation,
						),
					}
				: {}),
			// The editions are told apart by id, the first being the one shown.
			...(display.bars
				? {
						bars: barsFor(declaration, display.bars),
						datasetId: Object.keys(display.bars.measures)[0],
						keyBy: "id" as const,
					}
				: {}),
			calculateStats: (
				aggregator,
				geojson,
				data,
				location,
				datasetId,
				dataset,
			) => {
				const records = recordsVia ? dataset : data;
				return records
					? aggregator.aggregate(
							aggregation,
							geojson,
							records as Record<string, unknown>,
							location,
							datasetId,
						)
					: null;
			},
			year: display.year,
		},
		map: {
			valueFor: (dataset, code, options) => {
				const key = recordKey(
					dataset as unknown as Record<string, unknown>,
					recordsVia,
					code,
				);
				return key === undefined
					? null
					: valueOf(
							(dataset.data as Record<string, unknown>)[key],
							optionsOf(options).field,
						);
			},
			sourceMode: (_dataset, options) =>
				`${declaration.id}:${optionsOf(options).id}`,
			...(display.measures.some((measure) => measure.rangeFromData)
				? {
						getColorRange: (dataset, options) => {
							const measure = optionsOf(options);
							if (!measure.rangeFromData)
								return measure.colorRange;
							let min = Infinity;
							let max = -Infinity;
							for (const record of Object.values(
								dataset.data as Record<string, unknown>,
							)) {
								const value = valueOf(record, measure.field);
								if (value === null) continue;
								min = Math.min(min, value);
								max = Math.max(max, value);
							}
							return min <= max
								? { min, max }
								: measure.colorRange;
						},
					}
				: {}),
			colorRange: first.colorRange,
			...(first.invertColor === false ? { invertColor: false } : {}),
			legend: {
				bounds: (options) => {
					const { legend } = optionsOf(options);
					return { min: legend.min, max: legend.max };
				},
				min: first.legend.min,
				max: first.legend.max,
				format: (value, options) =>
					formatDisplay(optionsOf(options).legend.format, value),
			},
		},
	};
};

/** The chart definition of every declared dataset that has a display or categories. */
export const DECLARED_CHART_DEFINITIONS: readonly ChartDatasetDefinition<CatalogueDataset>[] =
	[
		...displayed.map(
			(declaration) =>
				chartDefinitionOf(
					declaration,
				) as unknown as ChartDatasetDefinition<CatalogueDataset>,
		),
		...CATEGORY_CHART_DEFINITIONS,
	];

export type { DeclaredDatasetId };
