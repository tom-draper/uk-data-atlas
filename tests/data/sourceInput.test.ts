import { describe, expect, it } from "vitest";
import {
	isStagedPath,
	sourceDir,
	sourceInput,
	SOURCES,
	STAGING_DIR,
	type SourceName,
} from "@uk-data-atlas/datasets";

describe("sourceInput", () => {
	it("resolves a source name and the path inside its folder", () => {
		expect(sourceInput("census-2021-lsoa/data.csv")).toBe(
			sourceDir("census-2021-lsoa", "data.csv"),
		);
	});

	it("returns a path in the boundaries or postcodes root as it is", () => {
		for (const input of [
			"boundaries/data-zone/2021-ni/DZ2021.geojson",
			"postcodes/onspd/ONSPD.csv",
		])
			expect(sourceInput(input)).toBe(input);
	});

	it("rejects a path that names no source", () => {
		expect(() => sourceInput("nowhere/file.csv")).toThrow(
			"does not start with a source name",
		);
	});

	it("rejects a path into the staging folder, which nothing may read", () => {
		expect(() =>
			sourceInput(`${STAGING_DIR}/gp-appointments/file.csv`),
		).toThrow("is staged");
	});
});

describe("isStagedPath", () => {
	it("is true for the staging folder and anything under it", () => {
		for (const path of [
			"_staging",
			"_staging/gp-appointments",
			"_staging/gp-appointments/meta.json",
			"_staging\\gp-appointments",
		])
			expect(isStagedPath(path), path).toBe(true);
	});

	it("is false for built sources, including a folder that only starts alike", () => {
		for (const path of [
			"health/nhs-services/nhs-waiting",
			"core/lookups",
			"boundaries/ward",
			"economy/_staging",
			"_staging-notes/x",
		])
			expect(isStagedPath(path), path).toBe(false);
	});

	it("is false for every folder the table resolves", () => {
		for (const name of Object.keys(SOURCES) as SourceName[])
			expect(isStagedPath(sourceDir(name)), name).toBe(false);
	});
});
