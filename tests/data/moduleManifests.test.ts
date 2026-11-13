import { describe, expect, it } from "vitest";
import {
	CORE_COMPATIBILITY_KEY,
	DATASET_FOUNDATION_PARTS,
	DATASET_MODULE_IDS,
	DATASET_SPLIT_MODULES,
	MODULE_LICENCES,
	REGISTERED_DATASETS,
	buildModuleManifests,
	moduleOfDataset,
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
/** A dataset that stays in the population module. */
const POPULATION_DATASET = byId("population").datasets[0]!.id;

describe("module manifests", () => {
	it("hold one module per theme and split, then the foundation parts, in registry order", () => {
		expect(manifests.map(({ id }) => id)).toEqual(DATASET_MODULE_IDS);
		expect(DATASET_MODULE_IDS).toEqual(
			expect.arrayContaining([
				"population",
				"population-detail",
				"politics",
				"politics-sharealike",
				...DATASET_FOUNDATION_PARTS.map(({ id }) => id),
			]),
		);
	});

	it("hold every registered dataset once as a whole, in the module it is homed in", () => {
		const whole = manifests.flatMap(({ datasets }) =>
			datasets.filter(({ partial }) => !partial).map(({ id }) => id),
		);
		expect(whole.toSorted()).toEqual(
			REGISTERED_DATASETS.map(({ id }) => id).toSorted(),
		);
		for (const manifest of manifests)
			for (const dataset of manifest.datasets.filter(
				({ partial }) => !partial,
			))
				expect(moduleOfDataset(dataset)).toBe(manifest.id);
	});

	it("split the heavy population datasets out of population", () => {
		const detail = byId("population-detail");
		expect(detail.requires).toEqual([]);
		expect(detail.datasets.map(({ id }) => id).toSorted()).toEqual(
			DATASET_SPLIT_MODULES.find(
				({ id }) => id === "population-detail",
			)!.datasets.toSorted(),
		);
		expect(detail.themes).toEqual(["population"]);
		const population = byId("population").datasets.map(({ id }) => id);
		for (const { id } of detail.datasets)
			expect(population, id).not.toContain(id);
	});

	it("keep share-alike out of politics: the add-on holds only those rows", () => {
		const addOn = byId("politics-sharealike");
		expect(addOn.requires).toEqual(["politics"]);
		expect(byId("politics").addOns).toEqual(["politics-sharealike"]);
		expect(addOn.datasets).toEqual([
			expect.objectContaining({ id: "local-election", partial: true }),
		]);
		expect(addOn.licences?.map(({ id }) => id)).toEqual(["cc-by-sa-3.0"]);
		expect(addOn.licences?.every(({ shareAlike }) => shareAlike)).toBe(
			true,
		);
		const politics = byId("politics");
		expect(politics.licences?.some(({ shareAlike }) => shareAlike)).toBe(
			false,
		);
		const local = politics.datasets.find(
			({ id }) => id === "local-election",
		)!;
		expect(local.partial).toBe(false);
		expect(local.licences).toEqual(["open-parliament"]);
	});

	it("require only real modules, never a foundation part or themselves", () => {
		const ids = new Set(manifests.map(({ id }) => id));
		for (const manifest of manifests)
			for (const required of manifest.requires) {
				expect(ids.has(required), manifest.id).toBe(true);
				expect(required, manifest.id).not.toBe(manifest.id);
				expect(
					DATASET_FOUNDATION_PARTS.some(({ id }) => id === required),
				).toBe(false);
			}
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

	it("have no licence conflict once share-alike is its own add-on", () => {
		for (const manifest of manifests)
			expect(manifest.licenceConflict, manifest.id).toBeNull();
	});

	it("still flag a module that mixes share-alike data with other licences", () => {
		const mixed = buildModuleManifests({
			datasets: (id) => (id === POPULATION_DATASET ? [OGL, CC] : [OGL]),
		});
		expect(
			mixed.find(({ id }) => id === "population")!.licenceConflict,
		).toEqual({
			kind: "share-alike",
			shareAlike: ["cc-by-sa-3.0"],
			others: ["ogl-3.0"],
			datasets: [POPULATION_DATASET],
		});
	});

	it("report a licence it cannot resolve, and one not derived", () => {
		const unresolved = buildModuleManifests({
			datasets: (id) =>
				id === POPULATION_DATASET ? ["All rights reserved"] : [OGL],
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
