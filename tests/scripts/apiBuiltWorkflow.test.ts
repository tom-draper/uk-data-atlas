import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
import { isMap, isSeq, parseDocument } from "yaml";
import rootPackage from "../../package.json";
import apiPackage from "../../services/api/package.json";

const readWorkflow = () =>
	parseDocument(
		readFileSync(
			new URL("../../.github/workflows/api-built.yml", import.meta.url),
			"utf8",
		),
	);

it("keeps built API verification available weekly and on demand", () => {
	const workflow = readWorkflow();
	expect(workflow.errors).toEqual([]);
	expect(workflow.hasIn(["on", "workflow_dispatch"])).toBe(true);
	const schedule = workflow.getIn(["on", "schedule"]);
	assert(isSeq(schedule));
	expect(schedule.items).toHaveLength(1);
	const weekly = schedule.items[0];
	assert(isMap(weekly));
	expect(weekly.get("cron")).toMatch(/^\d+ \d+ \* \* [0-6]$/);
});

it("verifies prerequisites and builds data and runtime before running the API suite", () => {
	const steps = readWorkflow().getIn(["jobs", "built-api", "steps"]);
	assert(isSeq(steps));
	const commands = steps.items.flatMap((step) => {
		assert(isMap(step));
		const run = step.get("run");
		return typeof run === "string" ? [run] : [];
	});
	expect(commands).toEqual([
		"pnpm install --frozen-lockfile",
		"pnpm data:verify-precompiled",
		"pnpm --dir services/api build:data",
		"pnpm --dir services/api build:runtime",
		"pnpm --dir services/api test",
		"pnpm --dir services/api typecheck",
	]);
	const packages: Record<string, { scripts: Record<string, string> }> = {
		".": rootPackage,
		"services/api": apiPackage,
	};
	for (const command of commands.slice(1)) {
		const match = /^pnpm (?:--dir (\S+) )?(\S+)$/.exec(command);
		assert(match, `Unsupported workflow command: ${command}`);
		const [, directory = ".", script] = match;
		assert(script);
		expect(packages[directory]?.scripts[script], command).toEqual(
			expect.any(String),
		);
	}
});
