import { createHash } from "node:crypto";
import {
	existsSync,
	openSync,
	readFileSync,
	readSync,
	closeSync,
} from "node:fs";
import { join } from "node:path";
import type { AreaReleaseArtifact } from "./areaInventory";

type BoundaryMetadata = { files?: unknown };
export type GeometrySourceRegistry = {
	schemaVersion: 1;
	contentHash: string;
	releases: Array<Record<string, unknown>>;
};
const sha = (s: string | Buffer) =>
	"sha256:" + createHash("sha256").update(s).digest("hex");
const kebab = (s: string) =>
	s.replaceAll(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
const sourcePath = (directory: string) => {
	const meta = JSON.parse(
		readFileSync(join(directory, "meta.json"), "utf8"),
	) as BoundaryMetadata;
	if (!Array.isArray(meta.files)) return;
	const f = meta.files.find(
		(x) =>
			typeof x === "object" &&
			x !== null &&
			(x as { role?: unknown }).role === "source" &&
			typeof (x as { path?: unknown }).path === "string" &&
			/\.(geojson|shp)$/i.test((x as { path: string }).path),
	) as { path: string } | undefined;
	return f ? join(directory, f.path) : undefined;
};
// The projections a Shapefile's .prj names, by EPSG code. An unrecognised
// projection is reported by its own name, so it cannot be served until a
// transformation for it is declared.
const PRJ_CRS: Record<string, string> = {
	British_National_Grid: "EPSG:27700",
	OSGB_1936_British_National_Grid: "EPSG:27700",
	TM65_Irish_Grid: "EPSG:29902",
	GCS_WGS_1984: "EPSG:4326",
};
const shapefileCrs = (path: string) => {
	const prj = path.replace(/\.shp$/i, ".prj");
	if (!existsSync(prj)) return "unknown";
	const name = readFileSync(prj, "utf8").match(
		/^(?:PROJCS|GEOGCS)\["([^"]+)"/,
	)?.[1];
	return (name && PRJ_CRS[name]) ?? `PRJ:${name ?? "unknown"}`;
};
const crs = (path: string) => {
	if (path.toLowerCase().endsWith(".shp")) return shapefileCrs(path);
	const fd = openSync(path, "r");
	const b = Buffer.alloc(65536);
	const n = readSync(fd, b, 0, b.length, 0);
	closeSync(fd);
	const m = b
		.subarray(0, n)
		.toString("utf8")
		.match(/"crs"\s*:\s*\{[\s\S]*?"name"\s*:\s*"([^"]+)"/);
	return m?.[1] ?? "EPSG:4326";
};
// Grid corrections a release declares, by the id of their shared definition
// in data/boundaries/, which the website's boundary compiler also applies.
const declaredCorrections = (directory: string): string[] => {
	const meta = JSON.parse(
		readFileSync(join(directory, "meta.json"), "utf8"),
	) as { corrections?: unknown };
	return Array.isArray(meta.corrections)
		? meta.corrections.filter((id): id is string => typeof id === "string")
		: [];
};
export const createGeometrySourceRegistry = (
	root: string,
	artifacts: AreaReleaseArtifact[],
): GeometrySourceRegistry => {
	const releases = artifacts.map((a) => {
		const source = a.derivedFrom?.source;
		const g = source?.geography ?? a.geography;
		const r = source?.boundaryRelease ?? a.boundaryRelease;
		const dir = join(root, "data", "boundaries", kebab(g), r);
		const path = existsSync(join(dir, "meta.json"))
			? sourcePath(dir)
			: undefined;
		if (!path || !existsSync(path))
			return {
				id: a.geography + "/" + a.boundaryRelease,
				status: "not-available",
				reason: "No declared raw GeoJSON or Shapefile source is available.",
			};
		const corrections = declaredCorrections(dir);
		return {
			id: a.geography + "/" + a.boundaryRelease,
			status: "available",
			input: join("boundaries", kebab(g), r, path.slice(dir.length + 1)),
			// The whole file, so a caller can confirm the exact input that any
			// area in the release was read from.
			inputHash: sha(readFileSync(path)),
			crs: crs(path),
			codeProperty: a.codeProperty,
			...(corrections.length > 0 ? { corrections } : {}),
			...(a.derivedFrom ? { selection: a.derivedFrom.filter } : {}),
		};
	});
	const content = JSON.stringify({ schemaVersion: 1, releases });
	return { schemaVersion: 1, contentHash: sha(content), releases };
};
