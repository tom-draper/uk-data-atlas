import assert from "node:assert/strict";
import { test } from "vitest";
import {
	createBuildReport,
	logBuildHeader,
	logPlanForecast,
	logRunProblems,
	plural,
} from "../build-data-report.mjs";

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

const collect = () => {
	const lines: string[] = [];
	return { lines, log: (line: string) => lines.push(line) };
};
const named = (...names: string[]) => names.map((name) => ({ name }));
const noChecks = { run: false };

test("the header counts stages and notes skipped parity checks", () => {
	const { lines, log } = collect();
	logBuildHeader({
		log,
		adopt: false,
		plan: true,
		selected: named("a", "b", "c"),
		toRun: new Set(["a"]),
		skippedChecks: ["check-a"],
		checks: noChecks,
		isCheck: () => false,
		jobs: 1,
		memoryMb: 1000,
	});
	assert.deepEqual(lines, [
		"Data build plan: 3 stages, 1 to run, 2 unchanged",
		"Parity checks not run (1): check-a. Run them with pnpm data:verify or pnpm data:build --verify.",
		"",
	]);
});

test("the header names what switched the checks on and the job limit", () => {
	const { lines, log } = collect();
	logBuildHeader({
		log,
		adopt: false,
		plan: false,
		selected: named("check-a"),
		toRun: new Set(["check-a"]),
		skippedChecks: [],
		checks: { run: true, reason: "CI" },
		isCheck: () => true,
		jobs: 4,
		memoryMb: 2048.4,
	});
	assert.equal(lines[0], "Data build: 1 stage, 1 to run, 0 unchanged");
	assert.match(lines[1], /^Parity checks on \(CI\)/);
	assert.equal(lines[2], "Running up to 4 stages at once within 2,048 MB");
});

test("an adopt header skips the check and job notes", () => {
	const { lines, log } = collect();
	logBuildHeader({
		log,
		adopt: true,
		plan: false,
		selected: named("a"),
		toRun: new Set(),
		skippedChecks: [],
		checks: { run: true, reason: "CI" },
		isCheck: () => true,
		jobs: 4,
		memoryMb: 1000,
	});
	assert.deepEqual(lines, [
		"Data build: adopting existing outputs for 1 stage",
		"",
	]);
});

test("run problems list the stages involved and nothing when clean", () => {
	const { lines, log } = collect();
	logRunProblems({ log, undeclaredStages: [], mismatchedStages: [] });
	assert.deepEqual(lines, []);
	logRunProblems({
		log,
		undeclaredStages: ["a"],
		mismatchedStages: ["b", "c"],
	});
	assert.match(lines[0], /^Undeclared writes in 1 stage: a\./);
	assert.match(lines[1], /^Wrong output hashes in 2 stages: b, c\./);
});

test("the plan forecast logs the estimate and the schedule only for a plan", () => {
	const stages = [
		{ name: "a", dependencies: [] },
		{ name: "b", dependencies: ["a"] },
	];
	const forecast = (plan: boolean) => {
		const { lines, log } = collect();
		logPlanForecast({
			log,
			plan,
			adopt: false,
			selected: stages,
			toRun: new Set(["a", "b"]),
			jobs: 2,
			memoryMb: 1000,
			estimated: 2000,
			knownEstimates: 2,
			weightOf: () => 1000,
		});
		return lines;
	};
	assert.deepEqual(forecast(false), []);
	const lines = forecast(true);
	assert.match(lines[0], /^Estimated total: .* for 2 of 2 stages to run$/);
	assert.match(
		lines[2],
		/^Parallel schedule .* up to 2 at once within 1,000 MB\):$/,
	);
	assert.equal(lines[3], "  1. a");
	assert.equal(lines[4], "  2. b");
	assert.match(lines[5], /^Critical path: a > b \(.* of .* in all\)$/);
});
