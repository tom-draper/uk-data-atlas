import { describe, expect, it } from "vitest";
import { buildModuleManifests } from "@uk-data-atlas/datasets/registry";
import {
	licenceInputOf,
	planDist,
	type DistFacts,
	type SourceFact,
} from "../../scripts/dist-modules.mjs";

/**
 * The dist files are a pure function of the registry and the facts read from
 * `data/source` (docs/data-organisation.md, task 12). These tests use made-up
 * facts so they run without the raw sources.
 */

const fact = (licenceName: string, tag: string): SourceFact => ({
	title: `Source ${tag}`,
	publisher: `Publisher ${tag}`,
	sourceUrl: `https://example.org/${tag}`,
	licenceName,
	attribution: [`Contains data from Publisher ${tag}.`],
});

const OGL = "Open Government Licence v3.0";

/** One OGL fact per dataset, except the local elections, which are share-alike. */
const facts = (): DistFacts => {
	const ids = buildModuleManifests({ datasets: () => [] }).flatMap(
		({ datasets }) => datasets.map(({ id }) => id),
	);
	return {
		datasets: Object.fromEntries(
			ids.map((id) => [
				id,
				[
					fact(
						id === "local-election"
							? "Creative Commons Attribution-ShareAlike 3.0 Unported"
							: OGL,
						id,
					),
				],
			]),
		),
		foundation: {
			core: [fact(OGL, "core")],
			boundaries: [fact(OGL, "boundaries")],
			postcodes: [fact(OGL, "postcodes")],
		},
	};
};

describe("planDist", () => {
	const plan = planDist(facts(), "test");

	it("writes the same bytes for the same inputs", () => {
		expect([...planDist(facts(), "test")]).toEqual([...plan]);
	});

	it("writes a README and a manifest for every module", () => {
		const manifests = buildModuleManifests(licenceInputOf(facts()));
		for (const { id } of manifests) {
			expect(plan.has(`${id}/README.md`)).toBe(true);
			expect(plan.has(`sqlite/atlas-${id}.manifest.json`)).toBe(true);
		}
		for (const path of [
			"README.md",
			"catalogue.json",
			"licences.json",
			"CHANGELOG.md",
		])
			expect(plan.has(path)).toBe(true);
	});

	it("lists every dataset exactly once in the catalogue", () => {
		const catalogue = JSON.parse(plan.get("catalogue.json")!);
		const ids: string[] = catalogue.datasets.map(
			(d: { id: string }) => d.id,
		);
		expect(ids.length).toBeGreaterThan(0);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids.sort()).toEqual(Object.keys(facts().datasets).sort());
	});

	it("records no sizes or checksums before the databases exist", () => {
		for (const [path, text] of plan)
			if (path.endsWith(".manifest.json")) {
				const manifest = JSON.parse(text);
				expect(manifest.build).toEqual({
					status: "not-built",
					bytes: null,
					files: null,
				});
			}
		expect(plan.get("politics/README.md")).toContain("Not built yet");
	});

	it("flags the share-alike mix in the politics module", () => {
		const licences = JSON.parse(plan.get("licences.json")!);
		expect(
			licences.conflicts.map((c: { module: string }) => c.module),
		).toEqual(["politics"]);
		expect(plan.get("politics/README.md")).toContain("Licence conflict");
	});

	it("uses no em dashes", () => {
		for (const [path, text] of plan)
			expect(text.includes("—"), path).toBe(false);
	});

	it("matches the recorded README of a module", () => {
		expect(plan.get("transport/README.md")).toMatchSnapshot();
	});
});
