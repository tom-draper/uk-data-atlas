import { join } from "node:path";

export const conversionBacktestDirectory = (root: string) =>
	join(root, "data/build/conversion-backtest");

/** The result of the `conversion-backtest` stage. */
export const conversionBacktestPath = (root: string) =>
	join(conversionBacktestDirectory(root), "conversion-backtest.sqlite");

/** The backtest tables as markdown, for `docs/conversion-accuracy.md`. */
export const conversionBacktestTablesPath = (root: string) =>
	join(conversionBacktestDirectory(root), "backtest-tables.md");

export const convertedSeriesDirectory = (root: string) =>
	join(root, "data/build/converted-series");

/** The result of the `converted-series` stage, which `assemble-atlas` copies in. */
export const convertedSeriesPath = (root: string) =>
	join(convertedSeriesDirectory(root), "converted-series.sqlite");

/** What was converted, as markdown, for `docs/conversion-accuracy.md`. */
export const convertedSeriesSummaryPath = (root: string) =>
	join(convertedSeriesDirectory(root), "converted-series.md");
