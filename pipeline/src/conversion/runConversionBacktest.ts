import { existsSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { crosswalkWeightsPath } from "../crosswalk-weights/paths.ts";
import {
	runBacktest,
	type CaseResult,
	type ComparedValue,
} from "./backtest.ts";
import { BACKTEST_CASES, type BacktestCase } from "./backtestCases.ts";
import { checkBounds, fitErrorClasses } from "./errorModel.ts";
import {
	conversionBacktestPath,
	conversionBacktestTablesPath,
} from "./paths.ts";
import {
	writeBacktestDatabase,
	writeBacktestMarkdown,
	type BacktestRun,
} from "./storeBacktest.ts";

/**
 * The base database with every weight basis beside it, read only. The
 * conversion stages run before `assemble-atlas`, so the bases a crosswalk does
 * not carry itself are still in the `crosswalk-weights` component.
 */
export const openConversionSource = (root: string) => {
	const base = join(root, "data/build/atlas-base.sqlite");
	const weights = crosswalkWeightsPath(root);
	for (const path of [base, weights])
		if (!existsSync(path)) throw new Error(`Missing ${path}`);
	const database = new DatabaseSync(base, { readOnly: true });
	database
		.prepare("ATTACH DATABASE ? AS weights_component")
		.run(`file:${weights}?mode=ro`);
	return database;
};

/** Run the cases, then fit and check the error factors on what they compared. */
export const backtestRun = (
	database: DatabaseSync,
	cases: readonly BacktestCase[] = BACKTEST_CASES,
	onCase?: (result: CaseResult, milliseconds: number) => void,
): BacktestRun => {
	const fitting = new Set(
		cases.filter((entry) => entry.fits || entry.checks).map((c) => c.id),
	);
	const rows: ComparedValue[] = [];
	const results = runBacktest(database, cases, {
		onValue: (value) => {
			if (fitting.has(value.caseId)) rows.push(value);
		},
		onCase,
	});
	const classes = fitErrorClasses(cases, rows);
	const checks = classes.flatMap((errorClass) =>
		cases
			.filter(
				(entry) =>
					entry.bases.includes(errorClass.basis) &&
					(entry.id === errorClass.caseId ||
						entry.checks?.method === errorClass.method),
			)
			.map((entry) => checkBounds(entry, errorClass, rows)),
	);
	return { results, classes, checks };
};

export const buildConversionBacktest = (
	root: string,
	onCase?: (result: CaseResult, milliseconds: number) => void,
) => {
	const database = openConversionSource(root);
	try {
		const run = backtestRun(database, BACKTEST_CASES, onCase);
		const output = conversionBacktestPath(root);
		writeBacktestDatabase(output, run);
		writeBacktestMarkdown(conversionBacktestTablesPath(root), run);
		return { run, output };
	} finally {
		database.close();
	}
};
