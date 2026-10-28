import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ParquetTable } from "@uk-data-atlas/artifacts";

const rows = Number(process.argv[2] ?? 250000);
assert.ok(
	Number.isInteger(rows) && rows >= 1 && rows <= 250000,
	"rows must be 1..250000",
);
assert.ok(global.gc, "Run with --expose-gc");
const modulePath = process.argv[3]
	? resolve(process.argv[3])
	: "@uk-data-atlas/artifacts";
const writer: typeof import("@uk-data-atlas/artifacts") = await import(
	process.argv[3] ? pathToFileURL(modulePath).href : modulePath
);
const table: ParquetTable = {
	columns: [
		{
			name: "id",
			type: "int32",
			values: Array.from({ length: rows }, (_, index) => index + 1),
		},
		{
			name: "code",
			type: "string",
			values: Array.from(
				{ length: rows },
				(_, index) => `E${String(index).padStart(8, "0")}`,
			),
		},
		{
			name: "value",
			type: "double",
			values: Array.from({ length: rows }, (_, index) => index / 100),
		},
		{
			name: "status",
			type: "string",
			values: Array(rows).fill("observed"),
		},
	],
};
global.gc();
const before = process.memoryUsage();
const cpuStarted = process.cpuUsage();
const started = performance.now();
const file = writer.writeParquet(table);
const elapsedMs = performance.now() - started;
const cpu = process.cpuUsage(cpuStarted);
assert.ok(Buffer.isBuffer(file) && file.length > 0);
console.log(
	JSON.stringify({
		rows,
		modulePath,
		node: process.version,
		execArgv: process.execArgv,
		bytes: file.length,
		sha256: createHash("sha256").update(file).digest("hex"),
		elapsedMs,
		cpuMs: (cpu.user + cpu.system) / 1000,
		rssBefore: before.rss,
		peakRssBytes: process.resourceUsage().maxRSS * 1024,
		heapBefore: before.heapUsed,
		heapAfter: process.memoryUsage().heapUsed,
	}),
);
