import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { readApiCatalogues } from "../src/catalogueLoader";

const apiRoot = resolve(import.meta.dirname, "..");
const started = performance.now();
const heapBefore = process.memoryUsage().heapUsed;
let resolverMilliseconds = 0;
readApiCatalogues(apiRoot, {
	onStage: (stage, milliseconds) => {
		if (stage === "geography-resolver") resolverMilliseconds = milliseconds;
	},
});
const totalMilliseconds = performance.now() - started;
const heapAfter = process.memoryUsage().heapUsed;

console.log(
	JSON.stringify(
		{
			totalMilliseconds,
			resolverMilliseconds,
			resolverShare: resolverMilliseconds / totalMilliseconds,
			heapIncreaseBytes: heapAfter - heapBefore,
		},
		null,
		2,
	),
);
