import assert from "node:assert/strict";
import { test } from "vitest";
import { createBuildReport, plural } from "../build-data-report.mjs";

function setup(options: { plan?: boolean; adopt?: boolean } = {}) {
	const lines: string[] = [];
	const summaries: any[] = [];
	const report = createBuildReport({
		cache: {
			writeBuildSummary: (summary: unknown) => summaries.push(summary),
			generatedFiles: () => [["site/a.json", 10]],
		},
		log: (line: string) => lines.push(line),
		plan: options.plan ?? false,
		adopt: options.adopt ?? false,
		verbose: false,
		startedAt: performance.now(),
		buildStartedAt: "2026-01-01T00:00:00.000Z",
	});
	return { lines, summaries, report };
}

test("plural counts with the right noun form", () => {
	assert.equal(plural(1, "stage"), "1 stage");
	assert.equal(plural(2, "stage"), "2 stages");
});

test("a finished build writes the summary and logs totals and assets", () => {
	const { lines, summaries, report } = setup();
	report.recordTiming("a", performance.now(), 0, true);
	report.recordTiming("b", performance.now() - 5, 3);
	report.reportSummary(false);
	assert.equal(summaries.length, 1);
	assert.deepEqual(
		summaries[0].stages.map((stage: any) => [stage.name, stage.status]),
		[
			["a", "skipped"],
			["b", "ran"],
		],
	);
	assert.equal(summaries[0].failed, false);
	assert.match(lines[1], /^Data build done in .* \(1 ran, 1 unchanged\)$/);
	assert.ok(lines.includes("Slowest stages:"));
	assert.ok(
		lines.some((line) => line.startsWith("Generated assets (1 file")),
	);
});

test("a failed build reports the failure and no generated assets", () => {
	const { lines, summaries, report } = setup();
	report.recordTiming("a", performance.now() - 5, 3);
	report.timings.at(-1).failed = true;
	report.reportSummary(true);
	assert.equal(summaries[0].stages[0].status, "failed");
	assert.match(
		lines[1],
		/^Data build failed after .* \(0 ran, 1 failed, 0 unchanged\)$/,
	);
	assert.ok(!lines.some((line) => line.startsWith("Generated assets")));
});

test("a plan writes no summary and logs nothing", () => {
	const { lines, summaries, report } = setup({ plan: true });
	report.reportSummary(false);
	assert.deepEqual(summaries, []);
	assert.deepEqual(lines, []);
});
