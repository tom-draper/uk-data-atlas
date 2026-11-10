import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { quantile } from "./backtest.ts";
import {
	convertEntry,
	readErrorFactors,
	STATUS_ESTIMATED,
	type ConvertedSeries,
} from "./convertSeries.ts";
import { CONVERTED_PLAN, type PlanEntry } from "./convertedPlan.ts";
import {
	conversionBacktestPath,
	convertedSeriesPath,
	convertedSeriesSummaryPath,
} from "./paths.ts";
import { createResolver } from "./pinnedRoutes.ts";
import { conversionRules, readMeasures } from "./rules.ts";
import { openConversionSource } from "./runConversionBacktest.ts";
import { areaNamer } from "./seriesValues.ts";
import { BACKTEST_TABLES, number, percent, table } from "./storeBacktest.ts";
import {
	openConvertedWriter,
	writeMeasureConversions,
	type RuledMeasure,
} from "./storeConverted.ts";

/** What one plan entry came to, for the summary the accuracy report quotes. */
export type EntrySummary = {
	entry: PlanEntry;
	series: number;
	periods: number;
	regrouped: number;
	estimated: number;
	gaps: Record<string, number>;
	/** Half the width of each estimated value's bounds, over the value. */
	halfWidths: number[];
	/** Source areas whose value no crosswalk carried. */
	notCarried: Set<number>;
	sourceCheck?: { compared: number; maxDifference: number };
};

const summarise = (
	summary: EntrySummary,
	converted: ConvertedSeries,
): EntrySummary => {
	summary.series += 1;
	summary.periods = Math.max(summary.periods, converted.periods);
	for (const o of converted.observations)
		if (o.status === STATUS_ESTIMATED) {
			summary.estimated += 1;
			if (o.value > 0)
				summary.halfWidths.push((o.upper! - o.lower!) / 2 / o.value);
		} else summary.regrouped += 1;
	for (const gap of converted.gaps) {
		summary.gaps[gap.reason] = (summary.gaps[gap.reason] ?? 0) + 1;
		if (gap.reason === "not-carried") summary.notCarried.add(gap.area);
	}
	if (converted.sourceCheck) {
		const check = (summary.sourceCheck ??= {
			compared: 0,
			maxDifference: 0,
		});
		check.compared += converted.sourceCheck.compared;
		check.maxDifference = Math.max(
			check.maxDifference,
			converted.sourceCheck.maxDifference,
		);
	}
	return summary;
};

/** The most area names a row of the summary lists. */
const NAMES_SHOWN = 6;

export const convertedMarkdown = (
	summaries: readonly EntrySummary[],
	rules: readonly RuledMeasure[],
	nameOf: (area: number) => string,
) => {
	const gapsOf = (summary: EntrySummary) =>
		Object.entries(summary.gaps)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([reason, values]) => `${reason} ${number(values)}`)
			.join(", ");
	const estimated = summaries.filter((summary) => summary.estimated > 0);
	const notCarried = summaries.filter((summary) => summary.notCarried.size);
	const checked = summaries.filter((summary) => summary.sourceCheck);
	const refused = rules.filter(({ rule }) => rule.rule === "refuse");
	const reasons = new Map<string, string[]>();
	for (const { measure, rule } of refused)
		reasons.set(rule.reason, [
			...(reasons.get(rule.reason) ?? []),
			measure.slug,
		]);
	return [
		"<!-- Written by the converted-series stage. Do not edit. -->",
		"",
		"## Converted series",
		"",
		table(
			[
				"Series",
				"From",
				"Onto",
				"Series",
				"Periods",
				"Regrouped values",
				"Estimated values",
				"Gaps",
			],
			summaries.map((summary) => [
				`${summary.entry.source.dataset} / ${summary.entry.source.measure}`,
				summary.entry.source.release,
				summary.entry.target,
				number(summary.series),
				number(summary.periods),
				number(summary.regrouped),
				number(summary.estimated),
				gapsOf(summary),
			]),
		),
		"",
		"## Bounds of the estimated values",
		"",
		table(
			[
				"Series",
				"Estimated values",
				"Median half width",
				"p95 half width",
				"Widest",
			],
			estimated.map((summary) => {
				const sorted = summary.halfWidths.sort((a, b) => a - b);
				return [
					summary.entry.id,
					number(summary.estimated),
					percent(quantile(sorted, 0.5), 3),
					percent(quantile(sorted, 0.95), 3),
					percent(sorted.at(-1) ?? null, 2),
				];
			}),
		),
		"",
		"## Source values no crosswalk carries",
		"",
		table(
			["Series", "Areas", "Names"],
			notCarried.map((summary) => {
				const names = [...summary.notCarried].map(nameOf).sort();
				return [
					summary.entry.id,
					number(names.length),
					names.length > NAMES_SHOWN
						? `${names.slice(0, NAMES_SHOWN).join(", ")} and ${number(names.length - NAMES_SHOWN)} more`
						: names.join(", "),
				];
			}),
		),
		"",
		"## Ratios rebuilt on their source areas, against the published ratio",
		"",
		table(
			["Series", "Compared", "Largest difference"],
			checked.map((summary) => [
				summary.entry.id,
				number(summary.sourceCheck!.compared),
				summary.sourceCheck!.maxDifference.toFixed(4),
			]),
		),
		"",
		"## Measure rules",
		"",
		table(
			["Rule", "Measures"],
			["sum", "rebuild", "refuse"].map((name) => [
				name,
				number(rules.filter(({ rule }) => rule.rule === name).length),
			]),
		),
		"",
		table(
			["Refused because", "Measures"],
			[...reasons].map(([reason, measures]) => [
				reason,
				`${number(measures.length)}: ${measures.join(", ")}`,
			]),
		),
		"",
	].join("\n");
};

export const buildConvertedSeries = (
	root: string,
	onEntry?: (summary: EntrySummary, milliseconds: number) => void,
) => {
	const backtestPath = conversionBacktestPath(root);
	if (!existsSync(backtestPath)) throw new Error(`Missing ${backtestPath}`);
	const database = openConversionSource(root);
	const backtest = new DatabaseSync(backtestPath, { readOnly: true });
	const output = convertedSeriesPath(root);
	const writer = openConvertedWriter(output);
	try {
		const rules = conversionRules(readMeasures(database));
		const context = {
			database,
			resolver: createResolver(database),
			rules: new Map(
				rules.map(({ measure, rule }) => [measure.slug, rule]),
			),
			factors: readErrorFactors(backtest),
		};
		const summaries: EntrySummary[] = [];
		for (const entry of CONVERTED_PLAN) {
			const started = performance.now();
			const summary: EntrySummary = {
				entry,
				series: 0,
				periods: 0,
				regrouped: 0,
				estimated: 0,
				gaps: {},
				halfWidths: [],
				notCarried: new Set(),
			};
			for (const converted of convertEntry(context, entry)) {
				writer.add(converted);
				summarise(summary, converted);
			}
			summaries.push(summary);
			onEntry?.(summary, performance.now() - started);
		}
		writeMeasureConversions(writer.database, rules);
		// The backtest the bounds came from travels with the series.
		writer.database.exec("COMMIT");
		writer.database
			.prepare("ATTACH DATABASE ? AS backtest")
			.run(`file:${backtestPath}?mode=ro`);
		writer.database.exec("BEGIN");
		for (const name of BACKTEST_TABLES)
			writer.database.exec(
				`INSERT INTO main.${name} SELECT * FROM backtest.${name}`,
			);
		writer.database.exec("COMMIT; DETACH DATABASE backtest; BEGIN");
		writer.finish();
		const namer = areaNamer(database);
		const summaryPath = convertedSeriesSummaryPath(root);
		mkdirSync(dirname(summaryPath), { recursive: true });
		writeFileSync(
			summaryPath,
			convertedMarkdown(summaries, rules, (area) => {
				const { code, name } = namer(area);
				return `${name} (${code})`;
			}),
		);
		return { summaries, output };
	} catch (error) {
		writer.abandon();
		throw error;
	} finally {
		backtest.close();
		database.close();
	}
};
