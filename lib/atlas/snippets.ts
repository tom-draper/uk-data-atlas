import figures from "@/public/data/datasets/map-figures.json";
import { type MapFigures, mapFigureSentence } from "@/lib/atlas/figures";
import {
	type AtlasLocation,
	type AtlasMap,
	atlasPageDescription,
} from "@/lib/atlas/pages";

/** The place's headline figure on a map, as a sentence, if it has one. */
export function atlasMapFigure(location: AtlasLocation, map: AtlasMap) {
	return mapFigureSentence(
		figures as unknown as MapFigures,
		location,
		map.slug,
	);
}

/** A map page's search snippet, led by the place's headline figure. */
export function atlasMapSnippet(location: AtlasLocation, map: AtlasMap) {
	return atlasPageDescription(location, map, atlasMapFigure(location, map));
}
