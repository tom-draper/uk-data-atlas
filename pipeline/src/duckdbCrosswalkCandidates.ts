import type { DuckDBConnection } from "@duckdb/node-api";
import type { Bounds } from "@uk-data-atlas/geography/area-geometry-pieces";

type Boxes = ReadonlyMap<string, { bounds: Bounds }>;

export async function duckdbCrosswalkCandidates(
	connection: DuckDBConnection,
	sources: Boxes,
	targets: Boxes,
): Promise<Map<string, string[]>> {
	await connection.run(
		"CREATE TEMP TABLE boxes (side INTEGER, position INTEGER, code VARCHAR, minx DOUBLE, miny DOUBLE, maxx DOUBLE, maxy DOUBLE)",
	);
	const appender = await connection.createAppender("boxes");
	try {
		for (const [side, geometries] of [
			[0, sources],
			[1, targets],
		] as const) {
			let position = 0;
			for (const [code, geometry] of geometries) {
				appender.appendInteger(side);
				appender.appendInteger(position++);
				appender.appendVarchar(code);
				for (const value of geometry.bounds)
					appender.appendDouble(value);
				appender.endRow();
			}
		}
	} finally {
		appender.closeSync();
	}
	const rows = await connection.runAndReadAll(
		`SELECT s.code, t.code FROM boxes s JOIN boxes t ON ST_Intersects(ST_MakeEnvelope(s.minx, s.miny, s.maxx, s.maxy), ST_MakeEnvelope(t.minx, t.miny, t.maxx, t.maxy)) WHERE s.side = 0 AND t.side = 1 ORDER BY s.position, t.position`,
	);
	const candidates = new Map<string, string[]>();
	for (const [source, target] of rows.getRows()) {
		if (typeof source !== "string" || typeof target !== "string")
			throw new Error("DuckDB returned an invalid crosswalk candidate.");
		const codes = candidates.get(source) ?? [];
		codes.push(target);
		candidates.set(source, codes);
	}
	return candidates;
}
