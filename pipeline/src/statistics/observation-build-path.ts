import { join } from "node:path";

export const observationBuildPath = (root: string) =>
	join(root, "data/build/observations.sqlite");
