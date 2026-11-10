import { join } from "node:path";
import { readJsonSync } from "../lib/json.ts";
type BoundaryMetadata = { files?: unknown };
export const sourceGeoJsonPath = (directory: string) => {
	const metadata = readJsonSync(
		join(directory, "meta.json"),
	) as BoundaryMetadata;
	if (!Array.isArray(metadata.files)) return undefined;
	const file = metadata.files.find(
		(candidate) =>
			typeof candidate === "object" &&
			candidate !== null &&
			(candidate as { role?: unknown }).role === "source" &&
			typeof (candidate as { path?: unknown }).path === "string" &&
			(candidate as { path: string }).path
				.toLowerCase()
				.endsWith(".geojson"),
	) as { path: string } | undefined;
	return file ? join(directory, file.path) : undefined;
};
