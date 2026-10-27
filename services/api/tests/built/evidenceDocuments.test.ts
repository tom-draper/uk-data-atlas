import assert from "node:assert/strict";
import {
	mkdtempSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { createApiServer } from "../../src/apiServer";
import { readApiCatalogues } from "../../src/catalogueLoader";
import {
	artifactRoot,
	buildDirectory,
	repositoryRootOf,
} from "../../../../shared/dataLayout";

const apiRoot = resolve(import.meta.dirname, "../..");

test("loads evidence build inputs when the previous document manifest is stale", (t) => {
	const repository = mkdtempSync(join(tmpdir(), "evidence-rebuild-"));
	t.after(() => rmSync(repository, { recursive: true, force: true }));
	const root = join(repository, "services/api");
	mkdirSync(root, { recursive: true });
	// Link every project and data entry except the artifacts, which hold the
	// one document manifest this test replaces.
	const link = (from: string, to: string, except?: string) => {
		mkdirSync(to, { recursive: true });
		for (const entry of readdirSync(from))
			if (entry !== except)
				symlinkSync(join(from, entry), join(to, entry));
	};
	link(apiRoot, root);
	const realBuild = buildDirectory(repositoryRootOf(apiRoot));
	link(dirname(realBuild), join(repository, "data"), "build");
	link(realBuild, join(repository, "data", "build"), "artifacts");
	const directory = artifactRoot(root);
	mkdirSync(directory);
	for (const entry of readdirSync(artifactRoot(apiRoot))) {
		if (entry !== "evidence-documents.json")
			symlinkSync(
				join(artifactRoot(apiRoot), entry),
				join(directory, entry),
			);
	}
	const manifest = JSON.parse(
		readFileSync(
			join(artifactRoot(apiRoot), "evidence-documents.json"),
			"utf8",
		),
	);
	writeFileSync(
		join(directory, "evidence-documents.json"),
		JSON.stringify({ ...manifest, dataCatalogHash: "previous-catalogue" }),
	);
	assert.throws(
		() => readApiCatalogues(root),
		/Evidence documents were not built from this data catalogue/,
	);
	const inputs = readApiCatalogues(root, { loadEvidenceDocuments: false });
	assert.equal(inputs.documents.size, 0);
	assert.equal(
		inputs.dataCatalog.measures.some(({ id }) => id === "population"),
		true,
	);
});

test("links measures to immutable reports and retires evidence query endpoints", async (t) => {
	const catalogues = readApiCatalogues(apiRoot);
	const server = createApiServer(catalogues);
	await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
	t.after(() => {
		server.closeAllConnections();
		server.close();
	});
	const address = server.address();
	assert.ok(address && typeof address !== "string");
	const base = `http://127.0.0.1:${address.port}`;
	const measure = await fetch(`${base}/v1/measures/population`);
	assert.equal(measure.status, 200);
	const metadata: { data: { documents: { evidence: string } } } =
		await measure.json();
	assert.equal(
		metadata.data.documents.evidence,
		"/v1/documents/measure-population.json",
	);
	const document = await fetch(base + metadata.data.documents.evidence);
	assert.equal(document.status, 200);
	const report: {
		data: {
			measure: string;
			quality: { status: number };
			coveragePlans: unknown[];
			reconciliations: unknown[];
		};
	} = await document.json();
	assert.equal(report.data.measure, "population");
	assert.equal(report.data.quality.status, 200);
	assert.ok(report.data.coveragePlans.length > 0);
	assert.ok(report.data.reconciliations.length > 0);
	const etag = document.headers.get("etag");
	assert.ok(etag);
	assert.equal(
		(
			await fetch(base + metadata.data.documents.evidence, {
				headers: { "if-none-match": etag },
			})
		).status,
		304,
	);
	for (const path of [
		"/v1/data/population/aggregate",
		"/v1/measures/population/quality",
		"/v1/measures/population/compatibility",
		"/v1/measures/population/coverage-plan",
		"/v1/measures/population/reconciliation",
		"/v1/validation",
		"/v1/corrections",
		"/v1/geography-health",
		"/v1/relationship-candidates",
		"/v1/relationship-repairs",
	])
		assert.equal((await fetch(base + path)).status, 404, path);
	const value = await fetch(
		`${base}/v1/data/population/series?place=E08000025&geography=localAuthority&codeYear=2023`,
	);
	assert.equal(value.status, 200);
	const series: { data: { sourceGeography: { codeYear: number } } } =
		await value.json();
	assert.equal(series.data.sourceGeography.codeYear, 2023);
	assert.equal(
		(
			await fetch(
				`${base}/v1/data/population/series?place=E08000025&boundaryYear=2023`,
			)
		).status,
		400,
	);
});

test("serves geography evidence from SQLite with exact bytes and conditional ETags", async (t) => {
	const { readAtlasPayload } = await import("../../../../shared/atlasSqlite");
	const server = createApiServer(readApiCatalogues(apiRoot));
	await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
	t.after(() => {
		server.closeAllConnections();
		server.close();
	});
	const address = server.address();
	assert.ok(address && typeof address !== "string");
	for (const id of ["geography-inventory", "analysis-geography-validation"]) {
		const url: string = `http://127.0.0.1:${address.port}/v1/documents/${id}.json`;
		const response: Response = await fetch(url);
		assert.equal(response.status, 200);
		assert.equal(
			await response.text(),
			readAtlasPayload(resolve(apiRoot, "../.."), id),
		);
		const etag = response.headers.get("etag");
		assert.ok(etag);
		assert.equal(
			(await fetch(url, { headers: { "if-none-match": etag } })).status,
			304,
		);
	}
});
