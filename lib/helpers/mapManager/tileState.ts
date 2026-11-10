import { getFeatureProp } from "@uk-data-atlas/datasets";
import type { BoundaryGeojson } from "@uk-data-atlas/datasets";
import type { MapValues } from "@uk-data-atlas/map-tiles/mapValues";
import type { BoundaryTiles } from "@/lib/data/boundaries/tiles";

/**
 * The feature state key code-aligned values are set under. The fill reads it as
 * `['feature-state', 'value']`, as it reads the `value` property of the join it
 * replaces. Hover is set under its own key, so neither overwrites the other.
 */
export const VALUE_STATE = "value";

/** Where a drawn area's state values come from. */
export type StateSource =
	| { kind: "properties" }
	| {
			/** One number per area in the tiles' code list; `null` where it has none. */
			kind: "values";
			values: MapValues;
	  };

/**
 * The state to set on each tile feature id for the drawn collection: the
 * values the fill reads, for the areas the dataset draws.
 *
 * With the `properties` source the values are those the join put on each
 * feature; with `values` the `value` state is the area's entry in the array.
 * Both give an area the same state, which is what lets the array replace the
 * join without changing a colour.
 */
export function drawnTileState(
	drawn: BoundaryGeojson,
	tiles: Pick<BoundaryTiles, "codeKey" | "ids">,
	properties: readonly string[],
	source: StateSource,
): Map<number, Record<string, unknown>> {
	const states = new Map<number, Record<string, unknown>>();
	for (const feature of drawn.features) {
		const code = getFeatureProp(feature.properties, tiles.codeKey);
		const id = typeof code === "string" ? tiles.ids.get(code) : undefined;
		if (id === undefined) continue;
		const own = feature.properties as unknown as Record<string, unknown>;
		const state: Record<string, unknown> = {};
		for (const property of properties)
			state[property] =
				(source.kind === "values" && property === VALUE_STATE
					? source.values[id - 1]
					: own[property]) ?? null;
		states.set(id, state);
	}
	return states;
}
