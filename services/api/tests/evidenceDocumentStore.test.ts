import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	cachedEvidenceMeasure,
	writeEvidenceDocument,
} from "../../../pipeline/src/evidence/evidenceDocumentStore";
import { buildEvidenceMeasure } from "../../../pipeline/src/evidence/buildEvidenceMeasure";
import { sha256 } from "@uk-data-atlas/artifacts";

test("writes published evidence and reuses only matching cached inputs", () => {
	const directory = mkdtempSync(join(tmpdir(), "evidence-store-"));
	try {
		const data = {
			compilerHash: "compiler",
			inputsHash: "inputs",
			boundaryYear: 2021,
		};
		const document = writeEvidenceDocument(
			directory,
			"measure-example",
			data,
		);
		const body = readFileSync(join(directory, document.artifact), "utf8");
		assert.equal(
			body,
			'{"schemaVersion":1,"data":{"compilerHash":"compiler","inputsHash":"inputs","codeYear":2021}}\n',
		);
		assert.equal(document.bytes, Buffer.byteLength(body));
		assert.equal(document.contentHash, sha256(body));
		assert.deepEqual(
			cachedEvidenceMeasure(directory, "example", "inputs", "compiler"),
			document,
		);
		assert.equal(
			cachedEvidenceMeasure(directory, "example", "changed", "compiler"),
			undefined,
		);
		assert.equal(
			cachedEvidenceMeasure(directory, "example", "inputs", "changed"),
			undefined,
		);
		assert.equal(
			cachedEvidenceMeasure(directory, "missing", "inputs", "compiler"),
			undefined,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("assembles measure evidence for available releases and reconciliation periods", () => {
	const context = {
		dataCatalog: {
			contentHash: "catalogue",
			measures: [{ id: "population" }],
		},
		areaInventory: {
			releases: [
				{ geography: "ward", id: "2021", status: "available" },
				{ geography: "ward", id: "2020", status: "unavailable" },
			],
		},
	} as unknown as Parameters<typeof buildEvidenceMeasure>[0];
	let output: unknown;
	const result = buildEvidenceMeasure(context, "population", {
		measureQuality: (_context, id) => `quality:${id}`,
		measureCoverage: (_context, id) => `coverage:${id}`,
		measureCompatibility: (_context, id) => `compatibility:${id}`,
		reconciliation: (_context, _measure, selection, period) => ({
			status: 200,
			data: { selection, period },
		}),
		coveragePlan: (_context, _measure, target) => ({
			status: 200,
			data: target,
		}),
		measureCapability: () => "supported",
		availableReconciliations: () => [
			{ crosswalk: { id: "ward/lad" }, periods: ["2021"] },
		],
		write: (id, data) => {
			output = data;
			return { id, artifact: "path", bytes: 1, contentHash: "hash" };
		},
		compilerHash: "compiler",
		inputsHash: () => "inputs",
	});
	assert.equal(result.id, "measure-population");
	assert.deepEqual(output, {
		measure: "population",
		dataCatalogHash: "catalogue",
		compilerHash: "compiler",
		inputsHash: "inputs",
		quality: { status: 200, data: "quality:population" },
		coverage: { status: 200, data: "coverage:population" },
		compatibility: {
			status: 200,
			data: "compatibility:population",
		},
		conversionSupport: {
			status: 400,
			data: {
				type: "https://api.ukdataatlas.com/problems/invalid-query",
				title: "Invalid Query",
				status: 400,
				detail: "measure and to=geography/release are required.",
			},
		},
		coveragePlans: [
			{
				geography: "ward",
				release: "2021",
				capability: "supported",
				status: 200,
				data: { geography: "ward", boundaryRelease: "2021" },
			},
		],
		reconciliations: [
			{
				selector: "crosswalk=ward%2Flad",
				period: "2021",
				status: 200,
				data: { selection: { crosswalk: "ward/lad" }, period: "2021" },
			},
		],
	});
});

test("records an absent compatibility assessment as not found", () => {
	const context = {
		dataCatalog: {
			contentHash: "catalogue",
			measures: [{ id: "population" }],
		},
		areaInventory: { releases: [] },
	} as unknown as Parameters<typeof buildEvidenceMeasure>[0];
	let output: unknown;
	buildEvidenceMeasure(context, "population", {
		measureQuality: () => ({}),
		measureCoverage: () => ({}),
		measureCompatibility: () => undefined,
		reconciliation: () => ({ status: 200, data: {} }),
		coveragePlan: () => ({ status: 200, data: {} }),
		measureCapability: () => ({}),
		availableReconciliations: () => [],
		write: (id, data) => {
			output = data;
			return { id, artifact: "path", bytes: 1, contentHash: "hash" };
		},
		compilerHash: "compiler",
		inputsHash: () => "inputs",
	});
	assert.deepEqual((output as { compatibility: unknown }).compatibility, {
		status: 404,
		data: {
			type: "https://api.ukdataatlas.com/problems/not-found",
			title: "Not Found",
			status: 404,
			detail: "No published measure compatibility record matches that id.",
		},
	});
});
