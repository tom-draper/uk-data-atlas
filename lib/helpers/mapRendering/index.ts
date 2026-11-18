/**
 * How each dataset is painted on the map. The recipes are independent of the
 * MapLibre session: they take a MapRenderContext, which MapManager implements.
 */
export type { MapRenderContext } from "./context";
export {
	renderBrexit,
	renderBrexitConstituency,
	renderGeneralElection,
	renderLocalElection,
} from "./elections";
export { renderCategories } from "./demographics";
export { renderPopulationView } from "./population";
export { renderNumericDataset } from "./numeric";
export type { NumericDataset, NumericMapConfig } from "./numeric";
export { renderCustomDataset, renderCustomPoints } from "./custom";
