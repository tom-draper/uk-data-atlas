import type { ExpressionSpecification } from "maplibre-gl";

/** A MapLibre expression used in filters and paint properties. */
export type MapExpression = ExpressionSpecification;

/** A literal paint value or an expression resolved by MapLibre. */
export type PaintValue<T extends string | number = string | number> =
	| T
	| MapExpression;
