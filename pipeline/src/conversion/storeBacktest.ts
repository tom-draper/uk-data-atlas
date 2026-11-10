import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { CaseResult, ErrorSummary } from "./backtest.ts";
import type { BoundsCheck, ErrorClass } from "./errorModel.ts";

/** Writes a backtest run as tables, and as the markdown the accuracy report quotes. */

export type BacktestRun = {
	results: CaseResult[];
	classes: ErrorClass[];
	checks: BoundsCheck[];
};

export const BACKTEST_SCHEMA = `
CREATE TABLE conversion_backtest (
	case_id TEXT NOT NULL, basis_id TEXT NOT NULL,
	value_class TEXT NOT NULL CHECK (value_class IN ('regrouped','split')),
	title TEXT NOT NULL, kind TEXT NOT NULL, family TEXT NOT NULL,
	series INTEGER NOT NULL, periods INTEGER NOT NULL,
	compared INTEGER NOT NULL, exact INTEGER NOT NULL,
	median_relative REAL, p95_relative REAL, max_relative REAL,
	mean_absolute REAL NOT NULL, max_absolute REAL NOT NULL,
	median_per_risk REAL, p95_per_risk REAL, max_per_risk REAL,
	PRIMARY KEY (case_id, basis_id, value_class)) WITHOUT ROWID, STRICT;
CREATE TABLE conversion_backtest_gap (
	case_id TEXT NOT NULL, basis_id TEXT NOT NULL, reason TEXT NOT NULL, areas INTEGER NOT NULL,
	PRIMARY KEY (case_id, basis_id, reason)) WITHOUT ROWID, STRICT;
CREATE TABLE conversion_backtest_worst (
	case_id TEXT NOT NULL, basis_id TEXT NOT NULL, value_class TEXT NOT NULL, position INTEGER NOT NULL,
	code TEXT NOT NULL, name TEXT NOT NULL, members TEXT NOT NULL, period TEXT NOT NULL,
	converted REAL NOT NULL, truth REAL NOT NULL, at_risk REAL NOT NULL,
	PRIMARY KEY (case_id, basis_id, value_class, position)) WITHOUT ROWID, STRICT;
CREATE TABLE conversion_error (
	method TEXT NOT NULL, basis_id TEXT NOT NULL, measure_class TEXT NOT NULL,
	case_id TEXT NOT NULL, compared INTEGER NOT NULL,
	median_factor REAL NOT NULL, p95_factor REAL NOT NULL, max_factor REAL NOT NULL, factor REAL NOT NULL,
	pruned_only INTEGER NOT NULL, pruned_only_exact INTEGER NOT NULL,
	PRIMARY KEY (method, basis_id, measure_class)) WITHOUT ROWID, STRICT;
CREATE TABLE conversion_error_check (
	case_id TEXT NOT NULL, basis_id TEXT NOT NULL, method TEXT NOT NULL, factor REAL NOT NULL,
	held_out INTEGER NOT NULL, compared INTEGER NOT NULL, covered INTEGER NOT NULL,
	median_relative_error REAL, median_relative_half_width REAL, p95_relative_half_width REAL,
	PRIMARY KEY (case_id, basis_id, method)) WITHOUT ROWID, STRICT;
`;

/** The tables `assemble-atlas` carries into `atlas.sqlite`. */
export const BACKTEST_TABLES = [
	"conversion_backtest",
	"conversion_backtest_gap",
	"conversion_backtest_worst",
	"conversion_error",
	"conversion_error_check",
] as const;

export const writeBacktestTables = (
	database: DatabaseSync,
	run: BacktestRun,
) => {
	const summary = database.prepare(
		"INSERT INTO conversion_backtest VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
	);
	const gap = database.prepare(
		"INSERT INTO conversion_backtest_gap VALUES (?,?,?,?)",
	);
	const worst = database.prepare(
		"INSERT INTO conversion_backtest_worst VALUES (?,?,?,?,?,?,?,?,?,?,?)",
	);
	for (const result of run.results) {
		const entry = result.case;
		for (const s of result.summaries) {
			summary.run(
				entry.id,
				result.basis,
				s.kind,
				entry.title,
				entry.kind,
				entry.family,
				result.series,
				result.periods,
				s.compared,
				s.exact,
				s.medianRelative,
				s.p95Relative,
				s.maxRelative,
				s.meanAbsolute,
				s.maxAbsolute,
				s.medianPerRisk,
				s.p95PerRisk,
				s.maxPerRisk,
			);
			s.worst.forEach((value, index) =>
				worst.run(
					entry.id,
					result.basis,
					s.kind,
					index + 1,
					value.code,
					value.name,
					value.members,
					value.period,
					value.converted,
					value.truth,
					value.atRisk,
				),
			);
		}
		for (const [reason, areas] of Object.entries(result.gaps))
			gap.run(entry.id, result.basis, reason, areas);
	}
	const errorClass = database.prepare(
		"INSERT INTO conversion_error VALUES (?,?,?,?,?,?,?,?,?,?,?)",
	);
	for (const c of run.classes)
		errorClass.run(
			c.method,
			c.basis,
			c.measureClass,
			c.caseId,
			c.compared,
			c.medianFactor,
			c.p95Factor,
			c.maxFactor,
			c.factor,
			c.prunedOnly,
			c.prunedOnlyExact,
		);
	const check = database.prepare(
		"INSERT INTO conversion_error_check VALUES (?,?,?,?,?,?,?,?,?,?)",
	);
	for (const c of run.checks)
		check.run(
			c.caseId,
			c.basis,
			c.method,
			c.factor,
			c.heldOut ? 1 : 0,
			c.compared,
			c.covered,
			c.medianRelativeError,
			c.medianRelativeHalfWidth,
			c.p95RelativeHalfWidth,
		);
};

export const writeBacktestDatabase = (path: string, run: BacktestRun) => {
	mkdirSync(dirname(path), { recursive: true });
	const temporary = `${path}.tmp`;
	rmSync(temporary, { force: true });
	const database = new DatabaseSync(temporary);
	try {
		database.exec(`${BACKTEST_SCHEMA}; BEGIN`);
		writeBacktestTables(database, run);
		database.exec("COMMIT");
	} finally {
		database.close();
	}
	renameSync(temporary, path);
};

export const percent = (value: number | null, digits = 2) =>
	value === null ? "" : `${(value * 100).toFixed(digits)}%`;
export const number = (value: number | null, digits = 0) =>
	value === null
		? ""
		: value.toLocaleString("en-GB", {
				minimumFractionDigits: digits,
				maximumFractionDigits: digits,
			});
export const table = (head: string[], rows: string[][]) =>
	[
		`| ${head.join(" | ")} |`,
		`| ${head.map(() => "---").join(" | ")} |`,
		...rows.map((row) => `| ${row.join(" | ")} |`),
	].join("\n");
const gapsOf = (result: CaseResult) =>
	Object.entries(result.gaps)
		.map(([reason, areas]) => `${reason} ${number(areas)}`)
		.join(", ");
const errorCells = (s: ErrorSummary) => [
	number(s.compared),
	percent(s.exact / s.compared, 1),
	percent(s.medianRelative, 3),
	percent(s.p95Relative, 3),
	percent(s.maxRelative, 2),
	number(s.maxAbsolute),
];

/** The run as markdown tables. Every figure is from the run given. */
export const backtestMarkdown = (run: BacktestRun) => {
	const head = [
		"Case",
		"Basis",
		"Values",
		"Series",
		"Periods",
		"Compared",
		"Exact",
		"Median error",
		"p95 error",
		"Max error",
		"Max absolute",
	];
	const rowsOf = (kinds: readonly string[]) =>
		run.results
			.filter((result) => kinds.includes(result.case.kind))
			.flatMap((result) =>
				result.summaries.length === 0
					? [
							[
								result.case.id,
								result.basis,
								result.skipped ?? "nothing compared",
								...Array(8).fill(""),
							],
						]
					: result.summaries.map((s) => [
							result.case.id,
							result.basis,
							s.kind,
							number(result.series),
							number(result.periods),
							...errorCells(s),
						]),
			);
	const gapRows = run.results
		.filter((result) => Object.keys(result.gaps).length > 0)
		.map((result) => [result.case.id, result.basis, gapsOf(result)]);
	const worstRows = run.results
		.filter((result) => result.case.kind !== "noise")
		.flatMap((result) =>
			result.summaries.flatMap((s) =>
				s.worst
					.slice(0, 3)
					.map((value) => [
						result.case.id,
						result.basis,
						s.kind,
						`${value.name} (${value.code})`,
						[value.members, value.period]
							.filter(Boolean)
							.join(", "),
						number(value.converted, 1),
						number(value.truth),
						percent(
							Math.abs(value.converted - value.truth) /
								value.truth,
						),
					]),
			),
		);
	return [
		"### Census noise floor",
		"",
		table(head, rowsOf(["noise"])),
		"",
		"### Exact regroupings",
		"",
		table(head, rowsOf(["regroup"])),
		"",
		"### Estimated splits and chains",
		"",
		table(head, rowsOf(["split", "chain"])),
		"",
		"### Target areas with a published truth and no converted value",
		"",
		table(["Case", "Basis", "Areas by reason"], gapRows),
		"",
		"### Error per unit at risk, by splitting method and weight basis",
		"",
		table(
			[
				"Method",
				"Basis",
				"Measured on",
				"Fitted on",
				"Split values",
				"Median factor",
				"p95 factor",
				"Max factor",
				"Factor used",
				"Pruned only",
				"Pruned only exact",
			],
			run.classes.map((c) => [
				c.method,
				c.basis,
				c.measureClass,
				c.caseId,
				number(c.compared),
				number(c.medianFactor, 3),
				number(c.p95Factor, 3),
				number(c.maxFactor, 3),
				number(c.factor, 2),
				number(c.prunedOnly),
				number(c.prunedOnlyExact),
			]),
		),
		"",
		"### Do the bounds hold the truth",
		"",
		table(
			[
				"Case",
				"Basis",
				"Factor of",
				"Factor",
				"Held out",
				"Values",
				"Truth within bounds",
				"Median error",
				"Median half width",
				"p95 half width",
			],
			run.checks.map((c) => [
				c.caseId,
				c.basis,
				c.method,
				number(c.factor, 2),
				c.heldOut ? "yes" : "no",
				number(c.compared),
				`${number(c.covered)} (${percent(c.covered / Math.max(1, c.compared), 1)})`,
				percent(c.medianRelativeError, 3),
				percent(c.medianRelativeHalfWidth, 2),
				percent(c.p95RelativeHalfWidth, 2),
			]),
		),
		"",
		"### Worst cases",
		"",
		table(
			[
				"Case",
				"Basis",
				"Values",
				"Area",
				"Series and period",
				"Converted",
				"Published",
				"Error",
			],
			worstRows,
		),
		"",
	].join("\n");
};

export const writeBacktestMarkdown = (path: string, run: BacktestRun) => {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, backtestMarkdown(run));
};
