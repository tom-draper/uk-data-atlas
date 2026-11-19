import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	buildLog,
	formatCount,
	formatDuration,
	repoPath,
} from "@uk-data-atlas/atlas-db";
import { parseScriptArgs } from "../lib/args.ts";
import { isMainModule } from "../lib/entrypoint.ts";
import { readBenchmark, score } from "../notional/benchmark.ts";
import { readCovariates } from "../notional/census.ts";
import {
	baseline,
	DEFAULT_OPTIONS,
	mainMethod,
	OPEN_BOUND_FACTOR,
	partition,
	type MainOptions,
} from "../notional/estimate.ts";
import { readNotionalInputs } from "../notional/inputs.ts";
import {
	accuracyMarkdown,
	writeNotional,
	type StoredMethod,
} from "../notional/store.ts";

/**
 * Notional 2019 general election results on the 2024 constituencies, scored
 * against a published set when one is given. Run by hand, not part of the
 * build graph:
 *
 *   tsx src/stages/build-notional-elections.ts [--source <checkout>] [--benchmark <csv>]
 *
 * `--source` is a built checkout to read (default: this one). The output is
 * written under this checkout's `data/build/notional-elections`.
 */

const LABELS: Record<string, string> = {
	baseline: "Baseline: residents, uniform within old seat",
	"local-only": "Local results, seat average where missing",
	"local-ukip": "Plus UKIP for the Brexit Party",
	modelled: "Plus census model and adult raking (main)",
	open: "Main, without CC BY-SA local results",
};

const VARIANTS: [string, MainOptions][] = [
	["local-only", { model: "none", ukipForBrexit: false, rake: false }],
	["local-ukip", { model: "none", ukipForBrexit: true, rake: false }],
	["modelled", DEFAULT_OPTIONS],
];

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const started = performance.now();
	const root = resolve(dirname(scriptPath), "../../..");
	const { values } = parseScriptArgs({
		source: { type: "string" },
		benchmark: { type: "string" },
	});
	const source =
		typeof values.source === "string" ? resolve(values.source) : root;
	const inputs = readNotionalInputs(source);
	const covariates = readCovariates(inputs);
	const parts = partition(inputs, covariates);
	buildLog.info(
		`${formatCount(parts.pieces.length)} pieces from ${formatCount(parts.units.length)} local contests; ${formatCount(parts.changed.size)} seats changed`,
	);
	const benchmark =
		typeof values.benchmark === "string"
			? readBenchmark(resolve(values.benchmark))
			: undefined;
	const open = {
		...inputs,
		local: inputs.local.filter((source) => !source.shareAlike),
	};
	const methods: StoredMethod[] = [
		{ method: "baseline", estimate: baseline(inputs, parts) },
		...VARIANTS.map(([method, options]) => ({
			method,
			estimate: mainMethod(inputs, parts, options),
		})),
		{
			method: "open",
			estimate: mainMethod(open, partition(open, covariates)),
			boundFactor: OPEN_BOUND_FACTOR,
		},
	];
	for (const method of methods) {
		if (!benchmark) continue;
		method.score = score(method.estimate, benchmark, parts.changed);
		buildLog.info(
			`${method.method}: ${method.score.mae.toFixed(3)} points mean absolute error, ${method.score.winnersDiffer} winners differ`,
		);
	}
	const main = methods.find((m) => m.method === "modelled")!;
	const markdown = accuracyMarkdown(
		inputs,
		methods,
		(method) => LABELS[method] ?? method,
		"modelled",
	);
	const output = writeNotional(root, inputs, parts, methods, main, markdown);
	buildLog.info(
		`Notional estimates in ${formatDuration(performance.now() - started)}, to ${repoPath(output)}`,
	);
}
