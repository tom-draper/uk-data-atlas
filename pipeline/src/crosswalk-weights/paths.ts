import { join } from "node:path";

export const crosswalkWeightsDirectory = (root: string) =>
	join(root, "data/build/crosswalk-weights");

/** The result of the `crosswalk-weights` stage, which `assemble-atlas` copies in. */
export const crosswalkWeightsPath = (root: string) =>
	join(crosswalkWeightsDirectory(root), "crosswalk-weights.sqlite");
