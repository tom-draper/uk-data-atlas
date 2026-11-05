import { DATASET_DECLARATIONS } from "@uk-data-atlas/datasets/data/declarations";
import type { DeclaredDatasetId } from "@uk-data-atlas/datasets/data/declarations";
import {
	definitionOf,
	type DatasetDeclaration,
} from "@uk-data-atlas/datasets/declaration/dataset";
import type {
	DatasetDisplay,
	DisplayFormat,
	DisplayMeasure,
} from "@uk-data-atlas/datasets/declaration/display";
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
			return `${value.toFixed(format.digits)}${format.suffix ?? ""}`;
		case "count":
			return `${formatCount(value)}${format.suffix ?? ""}`;
		case "compact":
			return formatCompactCount(value);
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

const cardFor = (
	declaration: Displayed,
	measure: DisplayMeasure,
): ValueCardConfig | undefined => {
	const { card } = declaration.display;
	if (!card) return undefined;
	if (!measure.card)
		throw new Error(
			`${declaration.id} draws a card but measure ${measure.id} declares none`,
		);
	const { secondary } = card;
	return defineValueCard<
		{ data: Record<string, Record<string, unknown>> },
		Record<string, unknown>
	>({
		heading: card.heading,
		source: card.source,
		...(card.coverage ? { coverage: card.coverage } : {}),
		unit: measure.card.unit,
		...(measure.card.digits === undefined
			? {}
			: { digits: measure.card.digits }),
		maximum: measure.card.maximum,
		value: (record) => read(record, measure.field),
		...(secondary
			? {
					secondary: (record) => {
						const value = read(record, secondary.field);
						return value === null
							? undefined
							: formatDisplay(secondary.format, value);
					},
				}
			: {}),
	});
};

const chartDefinitionOf = (declaration: Displayed): ChartDatasetDefinition => {
	const { display } = declaration;
	const [first] = display.measures;
	const aggregation = createBoundaryAggregationSpec(
		declaration.id,
		display.aggregation.scope,
		(features, codeProp, data: Record<string, unknown>) =>
			(display.aggregation.aggregate as (records: unknown[]) => unknown)(
				collectBoundaryRecords(features, data, codeProp),
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
						card: cardFor(declaration, first),
						cardForOptions: (options: MapOptions) =>
							cardFor(declaration, optionsOf(options))!,
					}
				: {}),
			calculateStats: (aggregator, geojson, data, location, datasetId) =>
				aggregator.aggregate(
					aggregation,
					geojson,
					data as Record<string, unknown>,
					location,
					datasetId,
				),
			year: display.year,
		},
		map: {
			valueFor: (dataset, code, options) =>
				read(
					(dataset.data as Record<string, unknown>)[code],
					optionsOf(options).field,
				),
			sourceMode: (_dataset, options) =>
				`${declaration.id}:${optionsOf(options).id}`,
			colorRange: first.colorRange,
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
