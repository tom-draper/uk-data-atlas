import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	cachedEvidenceMeasure,
	writeEvidenceDocument,
} from "../../../shared/evidenceDocumentStore";
import { buildEvidenceMeasure } from "../../../shared/buildEvidenceMeasure";
import { sha256 } from "../../../shared/contentHash";

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
		report: (_context, url) => ({ status: 200, data: url }),
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
		quality: { status: 200, data: "/v1/measures/population/quality" },
		coverage: { status: 200, data: "/v1/measures/population/coverage" },
		compatibility: {
			status: 200,
			data: "/v1/measures/population/compatibility",
		},
		conversionSupport: {
			status: 200,
			data: "/v1/measures/population/conversion-support",
		},
		coveragePlans: [
			{
				geography: "ward",
				release: "2021",
				capability: "supported",
				status: 200,
				data: "/v1/measures/population/coverage-plan?geography=ward&release=2021",
			},
		],
		reconciliations: [
			{
				selector: "crosswalk=ward%2Flad",
				period: "2021",
				status: 200,
				data: "/v1/measures/population/reconciliation?crosswalk=ward%2Flad&period=2021",
			},
		],
	});
});
