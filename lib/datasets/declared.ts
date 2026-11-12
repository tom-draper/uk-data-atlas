import { DATASET_DECLARATIONS } from "@uk-data-atlas/datasets";
import type { DeclaredDatasetId } from "@uk-data-atlas/datasets";
import { definitionOf, type DatasetDeclaration } from "@uk-data-atlas/datasets";
import type {
	DatasetDisplay,
	DisplayField,
	DisplayFormat,
	DisplayMeasure,
} from "@uk-data-atlas/datasets";
import { getFeatureProp } from "@/lib/types";
import { createBoundaryAggregationSpec } from "@/lib/helpers/datasetAggregation/ports";
import { collectBoundaryRecords } from "@/lib/helpers/datasetAggregation/numeric";
import { formatCompactCount, formatCount } from "@/lib/helpers/formatCount";
import type { CatalogueDataset } from "@/lib/data/catalog";
import type { MapOptions } from "@/lib/types/mapOptions";
import type { ChartDatasetDefinition } from "./types.ts";
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

/** A chart group's name as it appears in chart keys: `Economics` is `economics`. */
const groupSlug = (group: string) => group.toLowerCase().replace(/\s+/g, "-");

export const declaredChartKey = (declaration: Displayed) =>
	`${groupSlug(declaration.display.group)}-${declaration.id}`;

export function formatDisplay(format: DisplayFormat, value: number): string {
	switch (format.kind) {
		case "decimal":
			return `${format.prefix ?? ""}${value.toFixed(format.digits)}${format.suffix ?? ""}`;
		case "count":
			return `${format.prefix ?? ""}${format.locale ? value.toLocaleString(format.locale) : formatCount(format.round ? Math.round(value) : value)}${format.suffix ?? ""}`;
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

/** The record describing an area, reached through `recordsVia` when the dataset names one. */
const recordKey = (
	dataset: Record<string, unknown>,
	via: string | undefined,
	code: string,
): string | undefined =>
	via === undefined
		? code
		: (dataset[via] as Record<string, string> | undefined)?.[code];

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
	return {
		...definitionOf(declaration),
		chart: {
			group: display.group,
			key: declaredChartKey(declaration),
			label: display.label,
			defaultVisible: display.defaultVisible,
			componentPath: display.component ?? DECLARED_CHART_COMPONENT,
			...(display.card
				? {
						card: cardFor(
							declaration,
							measureFor(display, display.card.fixedMeasure),
						),
						cardForOptions: (options: MapOptions) =>
							cardFor(
								declaration,
								display.card?.fixedMeasure
									? measureFor(
											display,
											display.card.fixedMeasure,
										)
									: optionsOf(options),
							)!,
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
			...(declaration.publishMapValues
				? { valueKey: first.field as string }
				: {
						valueFor: (dataset, code, options) => {
							const key = recordKey(
								dataset as unknown as Record<string, unknown>,
								recordsVia,
								code,
							);
							return key === undefined
								? null
								: valueOf(
										(
											dataset.data as Record<
												string,
												unknown
											>
										)[key],
										optionsOf(options).field,
									);
						},
						sourceMode: (_dataset, options) =>
							`${declaration.id}:${optionsOf(options).id}`,
					}),
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

/** The chart definition of every declared dataset that has a display. */
export const DECLARED_CHART_DEFINITIONS: readonly ChartDatasetDefinition<CatalogueDataset>[] =
	displayed.map(
		(declaration) =>
			chartDefinitionOf(
				declaration,
			) as unknown as ChartDatasetDefinition<CatalogueDataset>,
	);

export type { DeclaredDatasetId };
