import { parseArgs, type ParseArgsOptionsConfig } from "node:util";

/**
 * Parses a script's command-line flags and positional arguments.
 *
 * Unknown flags are kept rather than rejected (`strict` is off), so a script
 * never starts failing on an argument its callers already pass, and a script
 * imported by a test runner reads the runner's arguments harmlessly.
 *
 * With `strict` off a string flag given no value reads as `true`, so check
 * `typeof value === "string"` before using one.
 */
export const parseScriptArgs = <const Options extends ParseArgsOptionsConfig>(
	options: Options,
	args: readonly string[] = process.argv.slice(2),
) =>
	parseArgs({
		args: [...args],
		options,
		allowPositionals: true,
		strict: false,
	});
