import { describe, expect, it } from "vitest";
import {
	CORE_COMPATIBILITY_KEY,
	DATASET_FOUNDATION_PARTS,
	DATASET_THEMES,
	MODULE_LICENCES,
	REGISTERED_DATASETS,
	buildModuleManifests,
	moduleOfTopic,
	resolveLicences,
} from "@uk-data-atlas/datasets/registry";

const OGL = "Open Government Licence v3.0";
const OPL = "Open Parliament Licence";
const CC = "Creative Commons Attribution-ShareAlike 3.0 Unported";

const names = (id: string) =>
	id === "local-election"
		? [OPL, CC]
		: id === "general-election"
			? [OPL]
			: [OGL];

const manifests = buildModuleManifests({
	datasets: names,
	foundation: { core: [OGL], boundaries: [OGL, OPL] },
});
const byId = (id: string) => manifests.find((manifest) => manifest.id === id)!;

describe("module manifests", () => {
	it("hold one module per theme, then the foundation parts, in registry order", () => {
		expect(manifests.map(({ id }) => id)).toEqual([
			...DATASET_THEMES.map(({ id }) => id),
			...DATASET_FOUNDATION_PARTS.map(({ id }) => id),
		]);
	});

	it("hold every registered dataset exactly once, in the module of its topic", () => {
		const held = manifests.flatMap(({ datasets }) =>
			datasets.map(({ id }) => id),
		);
		expect(held.toSorted()).toEqual(
			REGISTERED_DATASETS.map(({ id }) => id).toSorted(),
		);
		for (const manifest of manifests)
			for (const dataset of manifest.datasets)
				expect(moduleOfTopic(dataset.topic)).toBe(manifest.id);
	});

	it("give every module the core compatibility key and a schema version", () => {
		for (const manifest of manifests) {
			expect(manifest.compatibility.core).toBe(CORE_COMPATIBILITY_KEY);
			expect(manifest.schemaVersion).toBeGreaterThan(0);
		}
	});

	it("leave size and checksums for the module build to fill", () => {
		for (const { build } of manifests)
			expect(build).toEqual({
				status: "not-built",
				bytes: null,
				files: null,
			});
	});

	it("resolve licences from the recorded names", () => {
		expect(resolveLicences(OGL)).toEqual(["ogl-3.0"]);
		expect(resolveLicences(CC)).toEqual(["cc-by-sa-3.0"]);
		expect(
			resolveLicences(
				"Open Parliament Licence (2021–2025); CC BY-SA 3.0 (2016–2019)",
			),
		).toEqual(["open-parliament", "cc-by-sa-3.0"]);
		expect(resolveLicences("All rights reserved")).toEqual([]);
		for (const licence of MODULE_LICENCES)
			expect(resolveLicences(licence.name)).toEqual([licence.id]);
	});

	it("flag a module that mixes share-alike data with other licences", () => {
		expect(byId("politics").licenceConflict).toEqual({
			kind: "share-alike",
			shareAlike: ["cc-by-sa-3.0"],
			others: ["ogl-3.0", "open-parliament"],
			datasets: ["local-election"],
		});
		expect(byId("population").licenceConflict).toBeNull();
		expect(byId("boundaries").licenceConflict).toBeNull();
	});

	it("report a licence it cannot resolve, and one not derived", () => {
		const unresolved = buildModuleManifests({
			datasets: (id) =>
				id === "population" ? ["All rights reserved"] : [OGL],
		});
		expect(
			unresolved.find(({ id }) => id === "population")!
				.unresolvedLicences,
		).toEqual(["All rights reserved"]);
		expect(byId("postcodes").licences).toBeNull();
		expect(byId("core").licences?.map(({ id }) => id)).toEqual(["ogl-3.0"]);
	});

	it("are the same on every build", () => {
		expect(
			buildModuleManifests({
				datasets: names,
				foundation: { core: [OGL], boundaries: [OGL, OPL] },
			}),
		).toEqual(manifests);
	});
});
