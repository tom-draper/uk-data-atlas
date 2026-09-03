import type { ExpressionSpecification } from "maplibre-gl";

/** MapLibre expression values, constructed through the helpers below. */
export type MapExpression = ExpressionSpecification;
export type PaintValue<T extends string | number = string | number> =
	T | MapExpression;

// MapLibre's published expression union is intentionally exhaustive. Keep the
// structural conversion here so renderers use named, reviewable operations.
const expression = (parts: unknown[]): MapExpression =>
	parts as unknown as MapExpression;

export const featureProperty = (name: string): MapExpression =>
	expression(["get", name]);

export const featureState = (name: string): MapExpression =>
	expression(["feature-state", name]);

export const equal = (left: MapExpression, right: unknown): MapExpression =>
	expression(["==", left, right]);

export const lessThan = (left: MapExpression, right: number): MapExpression =>
	expression(["<", left, right]);

export const boolean = (
	value: MapExpression,
	fallback: boolean,
): MapExpression => expression(["boolean", value, fallback]);

export const when = (
	conditions: readonly [MapExpression, PaintValue][],
	fallback: PaintValue,
): MapExpression => expression(["case", ...conditions.flat(), fallback]);

export const nullFallback = (
	property: string,
	fallback: PaintValue,
	value: PaintValue,
): MapExpression =>
	when([[equal(featureProperty(property), null), fallback]], value);

export const linearInterpolate = (
	input: MapExpression,
	stops: readonly (readonly [number, PaintValue])[],
): MapExpression =>
	expression(["interpolate", ["linear"], input, ...stops.flat()]);

export const categoryMatch = (
	property: string,
	values: Iterable<readonly [string, string]>,
	fallback: string,
): MapExpression =>
	expression([
		"match",
		featureProperty(property),
		...[...values].flat(),
		fallback,
	]);

/**
 * Builds a MapLibre filter that shows only the legend rows in `activeIds`.
 * A row without `values` is a catch-all "other" bucket: it matches anything
 * not covered by a sibling row's `values`. Returns `undefined` when every row
 * is active, so the caller can skip filtering entirely.
 */
export const categoryFilter = (
	property: string,
	legend: readonly { id: string; values?: readonly string[] }[],
	activeIds: ReadonlySet<string>,
): MapExpression | undefined => {
	if (activeIds.size >= legend.length) return undefined;

	const knownValues = legend.flatMap((item) => item.values ?? []);
	const clauses = legend
		.filter((item) => activeIds.has(item.id))
		.map((item) =>
			item.values
				? expression([
						"in",
						featureProperty(property),
						["literal", item.values],
					])
				: expression([
						"!",
						[
							"in",
							featureProperty(property),
							["literal", knownValues],
						],
					]),
		);

	if (clauses.length === 0) return expression(["!", ["all"]]);
	return expression(["any", ...clauses]);
};

export const hoverOpacity = (opacity: number): MapExpression =>
	when([[boolean(featureState("hover"), false), opacity * 0.58]], opacity);

export const zoomInterpolate = (
	stops: readonly [number, number][],
): MapExpression => linearInterpolate(expression(["zoom"]), stops);

export const heatmapDensity = (): MapExpression =>
	expression(["heatmap-density"]);

/** How a boundary fill is coloured, and how opaque it is at a given overlay setting. */
export type FillPaintConfig = {
	color: PaintValue<string>;
	opacity: (overlayOpacity: number) => PaintValue<number>;
};
