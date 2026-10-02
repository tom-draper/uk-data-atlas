import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	readResolverProjections,
	recordResolverProjections,
	resolverProjectionProblems,
} from "../../scripts/resolver-projections";

let datasets: string;

const write = (
	release: string,
	command: string,
	files: Record<string, string>,
) => {
	for (const [name, contents] of Object.entries(files))
		writeFileSync(join(datasets, name), contents);
	recordResolverProjections(
		datasets,
		release,
		command,
		new Map(Object.entries(files)),
	);
};

beforeEach(() => {
	datasets = mkdtempSync(join(tmpdir(), "resolver-projections-"));
});
afterEach(() => rmSync(datasets, { recursive: true, force: true }));

describe("resolver projections", () => {
	it("passes files written from one API build", () => {
		write("sha256:a", "pnpm lineage:build", { "area-lineage.json": "{}" });
		write("sha256:a", "pnpm containment:build", {
			"boundary-mappings.json": "{}",
		});
		expect(resolverProjectionProblems(datasets)).toEqual([]);
		expect(Object.keys(readResolverProjections(datasets).files)).toEqual([
			"area-lineage.json",
			"boundary-mappings.json",
		]);
	});

	it("fails when only one script is rerun after an API rebuild", () => {
		write("sha256:a", "pnpm lineage:build", { "area-lineage.json": "{}" });
		write("sha256:a", "pnpm containment:build", {
			"boundary-mappings.json": "{}",
		});
		write("sha256:b", "pnpm lineage:build", { "area-lineage.json": "[]" });
		expect(resolverProjectionProblems(datasets)).toEqual([
			expect.stringContaining("come from different API builds"),
		]);
	});

	it("fails when a file changes after it was written", () => {
		write("sha256:a", "pnpm lineage:build", { "area-lineage.json": "{}" });
		writeFileSync(join(datasets, "area-lineage.json"), "[]");
		expect(resolverProjectionProblems(datasets)).toEqual([
			"area-lineage.json has changed since pnpm lineage:build wrote it; run it again.",
		]);
	});

	it("fails when a recorded file is missing", () => {
		write("sha256:a", "pnpm lineage:build", { "area-lineage.json": "{}" });
		rmSync(join(datasets, "area-lineage.json"));
		expect(resolverProjectionProblems(datasets)).toEqual([
			"area-lineage.json is missing; run pnpm lineage:build.",
		]);
	});

	it("fails when nothing has been recorded", () => {
		expect(resolverProjectionProblems(datasets)).toEqual([
			"resolver-projections.json records no projections.",
		]);
	});
});
