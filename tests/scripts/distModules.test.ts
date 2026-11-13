import { describe, expect, it } from "vitest";
import { buildModuleManifests } from "@uk-data-atlas/datasets/registry";
import {
	formatBytes,
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

describe("planDist with built modules", () => {
	const builds = {
		transport: {
			status: "built",
			bytes: 2048,
			files: [
				{
					path: "sqlite/atlas-transport.sqlite",
					format: "sqlite",
					bytes: 2048,
					sha256: "a".repeat(64),
				},
				{
					path: "transport/parquet/observation.parquet",
					format: "parquet",
					bytes: 900,
					sha256: "b".repeat(64),
				},
			],
			rows: { observation: 12345, series: 0 },
		},
	} as const;
	const plan = planDist(facts(), "test", builds as never);

	it("records the size, checksums and rows in the manifest", () => {
		const manifest = JSON.parse(
			plan.get("sqlite/atlas-transport.manifest.json")!,
		);
		expect(manifest.build.status).toBe("built");
		expect(manifest.build.bytes).toBe(2048);
		expect(manifest.build.files[0].sha256).toBe("a".repeat(64));
		expect(manifest.build.rows.observation).toBe(12345);
	});

	it("describes the files, rows and assembler in the module README", () => {
		const readme = plan.get("transport/README.md")!;
		expect(readme).toContain("a".repeat(64));
		expect(readme).toContain("12,345");
		expect(readme).toContain("pnpm data:assemble");
		expect(readme).not.toContain("Not built yet");
		expect(plan.get("politics/README.md")).toContain("Not built yet");
	});

	it("writes DuckDB views for the Parquet files that exist", () => {
		const views = plan.get("duckdb-views.sql")!;
		expect(views).toContain("transport/parquet/observation.parquet");
		expect(planDist(facts(), "test").has("duckdb-views.sql")).toBe(false);
	});

	it("uses no em dashes", () => {
		for (const [path, text] of plan)
			expect(text.includes("—"), path).toBe(false);
	});

	it("formats sizes", () => {
		expect(formatBytes(512)).toBe("512 B");
		expect(formatBytes(1536)).toBe("1.5 KB");
		expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
	});
});
