import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { aggregateCounts } from "../../shared/duckdbPostcodeCounts";

const directory = mkdtempSync(join(tmpdir(), "atlas-duckdb-test-"));
try {
	const path = join(directory, "input's.sqlite");
	const db = new DatabaseSync(path);
	db.exec(`CREATE TABLE postcode_area_releases (position INTEGER, geography TEXT, boundaryRelease TEXT, areaColumn TEXT);
    CREATE TABLE areas (id INTEGER, code TEXT);
    CREATE TABLE postcodes (postcode TEXT, terminated INTEGER, largeUser TEXT, "testAreaId" INTEGER);
    CREATE TABLE postcode_area_matches (district TEXT, releasePosition INTEGER, postcodePosition INTEGER, areaId INTEGER);
    INSERT INTO postcode_area_releases VALUES (0,'test','v1','testAreaId');
    INSERT INTO areas VALUES (1,'A'),(2,'B');
    INSERT INTO postcodes VALUES ('AB11AA',0,'1',1),('AB11AB',202001,'0',1),('AB11AC',0,'0',NULL),('AB11AD',0,'0',NULL);
    INSERT INTO postcode_area_matches VALUES ('AB1',0,2,1),('AB1',0,2,2);`);
	db.close();
	const result = await aggregateCounts(path);
	assert.deepEqual(result.releases, [[0, "test", "v1", "testAreaId"]]);
	assert.deepEqual(result.counts, [
		[0, "A", 2, 1, 1],
		[0, "B", 1, 0, 0],
	]);
	console.log("DuckDB aggregation fixture passed");
} finally {
	rmSync(directory, { recursive: true, force: true });
}
