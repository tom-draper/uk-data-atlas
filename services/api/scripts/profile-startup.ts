import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeHeapSnapshot } from "node:v8";
import { readApiCatalogues } from "../src/catalogueLoader";

const apiRoot = resolve(import.meta.dirname, "..");
const started = performance.now();
const before = process.memoryUsage();
const stages: Array<{
	stage: string;
	milliseconds: number;
	memory: NodeJS.MemoryUsage;
}> = [];
readApiCatalogues(apiRoot, {
	onStage: (stage, milliseconds) => {
		stages.push({ stage, milliseconds, memory: process.memoryUsage() });
	},
});
const totalMilliseconds = performance.now() - started;
const after = process.memoryUsage();
const heapSnapshotPath = writeHeapSnapshot(
	process.env.ATLAS_HEAP_SNAPSHOT_PATH ??
		join(tmpdir(), `uk-data-atlas-startup-${process.pid}.heapsnapshot`),
);
const change = (from: NodeJS.MemoryUsage, to: NodeJS.MemoryUsage) => ({
	rssBytes: to.rss - from.rss,
	heapTotalBytes: to.heapTotal - from.heapTotal,
	heapUsedBytes: to.heapUsed - from.heapUsed,
	externalBytes: to.external - from.external,
	arrayBuffersBytes: to.arrayBuffers - from.arrayBuffers,
});

console.log(
	JSON.stringify(
		{
			totalMilliseconds,
			memoryBefore: before,
			memoryAfter: after,
			memoryIncrease: change(before, after),
			stages: stages.map(({ stage, milliseconds, memory }, index) => {
				const previous = stages[index - 1]?.memory ?? before;
				return {
					stage,
					milliseconds,
					memoryIncrease: change(before, memory),
					stageMemoryIncrease: change(previous, memory),
				};
			}),
			heapSnapshotPath,
		},
		null,
		2,
	),
);
