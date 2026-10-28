import { DuckDBInstance } from "@duckdb/node-api";

export type CountRow = [number, string, number, number, number];
export type Release = [number, string, string, string];

export async function aggregateCounts(path: string, threads?: number) {
	const instance = await DuckDBInstance.create(
		":memory:",
		threads === undefined ? {} : { threads: String(threads) },
	);
	const connection = await instance.connect();
	try {
		await connection.run("LOAD sqlite");
		await connection.run(
			`ATTACH '${path.replaceAll("'", "''")}' AS atlas (TYPE SQLITE, READ_ONLY)`,
		);
		const releases = (
			await connection.runAndReadAll(
				"SELECT position, geography, boundaryRelease, areaColumn FROM atlas.postcode_area_releases ORDER BY position",
			)
		)
			.getRows()
			.map(
				([position, geography, boundary, column]) =>
					[
						Number(position),
						String(geography),
						String(boundary),
						String(column),
					] as Release,
			);
		await connection.run(
			"CREATE TEMP TABLE counts (position INTEGER, code VARCHAR, live BIGINT, terminated BIGINT, large_user BIGINT)",
		);
		for (const [position, , , column] of releases) {
			const quoted = `"${column.replaceAll('"', '""')}"`;
			await connection.run(
				`INSERT INTO counts SELECT ${position}, a.code, count(*) FILTER (WHERE p.terminated = 0), count(*) FILTER (WHERE p.terminated <> 0), count(*) FILTER (WHERE p.terminated = 0 AND p.largeUser = '1') FROM atlas.postcodes p JOIN atlas.areas a ON p.${quoted} = a.id GROUP BY a.code`,
			);
		}
		await connection.run(
			`INSERT INTO counts WITH districts AS (SELECT DISTINCT district FROM atlas.postcode_area_matches), numbered AS (SELECT p.postcode, p.terminated, p.largeUser, left(p.postcode, length(p.postcode) - 3) AS district, row_number() OVER (PARTITION BY left(p.postcode, length(p.postcode) - 3) ORDER BY p.postcode) - 1 AS idx FROM atlas.postcodes p JOIN districts d ON left(p.postcode, length(p.postcode) - 3) = d.district) SELECT m.releasePosition, a.code, count(*) FILTER (WHERE n.terminated = 0), count(*) FILTER (WHERE n.terminated <> 0), count(*) FILTER (WHERE n.terminated = 0 AND n.largeUser = '1') FROM atlas.postcode_area_matches m JOIN numbered n ON m.district = n.district AND m.postcodePosition = n.idx JOIN atlas.areas a ON m.areaId = a.id GROUP BY m.releasePosition, a.code`,
		);
		const counts = (
			await connection.runAndReadAll(
				"SELECT position, code, sum(live), sum(terminated), sum(large_user) FROM counts GROUP BY position, code ORDER BY position, code",
			)
		)
			.getRows()
			.map(
				([position, code, live, terminated, large]) =>
					[
						Number(position),
						String(code),
						Number(live),
						Number(terminated),
						Number(large),
					] as CountRow,
			);
		return { releases, counts };
	} finally {
		connection.closeSync();
		instance.closeSync();
	}
}
