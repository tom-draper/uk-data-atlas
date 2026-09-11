import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { GeometrySource, GeometrySourceLookup } from "./areaGeometry";
type Registry = { schemaVersion?: unknown; releases?: unknown };
export const readGeometrySourceLookup = (
	apiRoot: string,
): GeometrySourceLookup => {
	const registry = JSON.parse(
		readFileSync(join(apiRoot, "public", "geometry-sources.json"), "utf8"),
	) as Registry;
	if (registry.schemaVersion !== 1 || !Array.isArray(registry.releases))
		throw new Error("Invalid geometry source registry.");
	return new Map(
		registry.releases.flatMap((release) => {
			if (typeof release !== "object" || release === null) return [];
			const r = release as Record<string, unknown>;
			if (
				r.status !== "available" ||
				typeof r.id !== "string" ||
				typeof r.input !== "string" ||
				typeof r.crs !== "string" ||
				typeof r.codeProperty !== "string"
			)
				return [];
			return [
				[
					r.id,
					{
						input: r.input,
						crs: r.crs,
						codeProperty: r.codeProperty,
					} satisfies GeometrySource,
				] as const,
			];
		}),
	);
};
