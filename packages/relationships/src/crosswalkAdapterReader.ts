import { readFileSync } from "node:fs";
import { parseCrosswalkAdapters } from "./crosswalkAdapters.ts";

export const readCrosswalkAdapters = (path: string) =>
	parseCrosswalkAdapters(readFileSync(path, "utf8"), path);
