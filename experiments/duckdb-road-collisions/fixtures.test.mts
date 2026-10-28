import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import {
	mkdtempSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const directory = mkdtempSync(join(tmpdir(), "road-collision-fixtures-"));
const sources = join(directory, "transport/road-safety");
mkdirSync(sources, { recursive: true });
const header =
	"collision_index,local_authority_ons_district,lsoa_of_accident_location,collision_severity,date\n";
const row = (
	id: string,
	code: string,
	lsoa: string,
	severity: string,
	date: string,
) => `${id},${code},${lsoa},${severity},${date}\n`;
const valid = (year: number) =>
	header +
	row("1", "E06000001", "E01000001", "1", `01/01/${year}`) +
	row("2", "S12000001", "-1", "2", `01/02/${year}`) +
	row("3", "EHEATHROW", "E01000001", "3", `01/02/${year}`);
const filenames = [2024, 2025].map((year) =>
	join(sources, `dft-road-casualty-statistics-collision-${year}.csv`),
);
function run(mode: string) {
	const output = join(directory, `${mode}.json`);
	const child = spawnSync(
		process.execPath,
		[
			"--import",
			"tsx",
			"experiments/duckdb-road-collisions/trial.mts",
			mode,
			output,
		],
		{
			encoding: "utf8",
			env: { ...process.env, ROAD_TRIAL_SOURCE_ROOT: directory },
		},
	);
	return { ...child, output };
}
try {
	for (const [name, first, second, succeeds] of [
		["valid counts and exclusions", valid(2024), valid(2025), true],
		[
			"invalid severity",
			valid(2024).replace(",1,01/01/2024", ",9,01/01/2024"),
			valid(2025),
			false,
		],
		[
			"invalid date",
			valid(2024).replace("01/01/2024", "bad-date"),
			valid(2025),
			false,
		],
		[
			"multiple years",
			valid(2024).replace("01/02/2024", "01/02/2023"),
			valid(2025),
			false,
		],
		[
			"missing month",
			valid(2024).replaceAll("01/02/2024", "01/03/2024"),
			valid(2025),
			false,
		],
		["empty file", header, valid(2025), false],
		["duplicate years", valid(2024), valid(2024), false],
	] as const) {
		test(name, () => {
			writeFileSync(filenames[0]!, first);
			writeFileSync(filenames[1]!, second);
			const node = run("node"),
				duckdb = run("duckdb");
			assert.equal(node.status === 0, succeeds, node.stderr);
			assert.equal(duckdb.status === 0, succeeds, duckdb.stderr);
			if (succeeds)
				assert.equal(
					readFileSync(duckdb.output, "utf8"),
					readFileSync(node.output, "utf8"),
				);
		});
	}
} finally {
	process.on("exit", () =>
		rmSync(directory, { recursive: true, force: true }),
	);
}
