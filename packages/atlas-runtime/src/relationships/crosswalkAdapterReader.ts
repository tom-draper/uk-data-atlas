import { readFileSync } from "node:fs";
import { parseCrosswalkAdapters } from "@uk-data-atlas/relationships";

export const readCrosswalkAdapters = (path: string) =>
	parseCrosswalkAdapters(readFileSync(path, "utf8"), path);
