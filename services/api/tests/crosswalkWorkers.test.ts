import assert from "node:assert/strict";
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
	compileCrosswalksInWorkers,
	crosswalkWorkerCount,
} from "../../../pipeline/src/crosswalk-workers";
import {
	compileCrosswalks,
	type CrosswalkArtifact,
} from "../src/crosswalkInventory";
import { readStoredText } from "../src/storedText";
import { writeCrosswalkArtifact } from "../../../pipeline/src/crosswalk-artifact";
import { crosswalkWorkerFixture } from "./helpers/crosswalkWorkerFixture";

const GIB = 1024 ** 3;
test("selects workers within CPU and available-memory budgets", () => {
	assert.equal(crosswalkWorkerCount(undefined, 5 * GIB, 12), 1);
	assert.equal(crosswalkWorkerCount(undefined, 20 * GIB, 12), 2);
	assert.equal(crosswalkWorkerCount("3", 20 * GIB, 12), 3);
	assert.equal(crosswalkWorkerCount(undefined, 20 * GIB, 1), 1);
	assert.throws(() => crosswalkWorkerCount("2", 5 * GIB, 12), /exceeds/);
	for (const value of ["0", "-1", "1.5", "invalid", "Infinity"])
		assert.throws(
			() => crosswalkWorkerCount(value, 20 * GIB, 12),
			/positive integer/,
		);
});

test(
	"workers produce serial artifacts and schedule populations after their pairs",
	{ timeout: 15_000 },
	async () => {
		const f = crosswalkWorkerFixture();
		try {
			const other = { ...f.area, id: "other" };
			const expected = [
				...compileCrosswalks(
					f.root,
					[f.area, other, f.population],
					f.areaLookup,
					f.geometrySources,
				),
			];
			const actual: CrosswalkArtifact[] = [];
			await compileCrosswalksInWorkers({
				repositoryRoot: f.root,
				outputDirectory: f.outputDirectory,
				adapters: [f.population, f.area, other],
				workers: 2,
				onCompiled: (artifact, seconds) => {
					assert.ok(seconds >= 0);
					actual.push(artifact);
				},
			});
			assert.ok(
				actual.findIndex(({ id }) => id === "area") <
					actual.findIndex(({ id }) => id === "population"),
			);
			assert.deepEqual(
				actual.sort((a, b) => a.id.localeCompare(b.id)),
				expected.sort((a, b) => a.id.localeCompare(b.id)),
			);
			assert.deepEqual(
				actual
					.find(({ id }) => id === "population")
					?.records[0]?.targets.map(({ code }) => code),
				["T"],
			);
			for (const artifact of actual)
				assert.deepEqual(
					JSON.parse(
						readStoredText(
							join(
								f.outputDirectory,
								"crosswalks",
								`${artifact.id}.json`,
							),
						),
					),
					artifact,
				);
		} finally {
			f.cleanup();
		}
	},
);

test(
	"workers verify reused pair hashes and preserve previous checkpoints on failure",
	{ timeout: 15_000 },
	async () => {
		const f = crosswalkWorkerFixture();
		try {
			const [pairs] = compileCrosswalks(
				f.root,
				[f.area],
				f.areaLookup,
				f.geometrySources,
			);
			const path = writeCrosswalkArtifact(f.outputDirectory, pairs!);
			const prior = new Map([
				[f.area.id, { path, contentHash: pairs!.contentHash }],
			]);
			const received: CrosswalkArtifact[] = [];
			await compileCrosswalksInWorkers({
				repositoryRoot: f.root,
				outputDirectory: f.outputDirectory,
				adapters: [f.population],
				prior,
				workers: 2,
				onCompiled: (artifact) => {
					received.push(artifact);
				},
			});
			assert.equal(received[0]?.id, "population");
			const checkpoint = readStoredText(path);
			prior.set(f.area.id, { path, contentHash: "sha256:wrong" });
			await assert.rejects(
				compileCrosswalksInWorkers({
					repositoryRoot: f.root,
					outputDirectory: f.outputDirectory,
					adapters: [f.population],
					prior,
					workers: 2,
					onCompiled: () =>
						assert.fail("invalid dependency compiled"),
				}),
				/invalid area-overlap dependency/,
			);
			assert.equal(readStoredText(path), checkpoint);
		} finally {
			f.cleanup();
		}
	},
);

test(
	"a failed compile stops the pool without replacing its checkpoint",
	{ timeout: 15_000 },
	async () => {
		const f = crosswalkWorkerFixture();
		try {
			const [previous] = compileCrosswalks(
				f.root,
				[f.area],
				f.areaLookup,
				f.geometrySources,
			);
			const path = writeCrosswalkArtifact(f.outputDirectory, previous!);
			const checkpoint = readStoredText(path);
			rmSync(join(f.root, "data/source/ward.geojson"));
			await assert.rejects(
				compileCrosswalksInWorkers({
					repositoryRoot: f.root,
					outputDirectory: f.outputDirectory,
					adapters: [f.area, { ...f.area, id: "other" }],
					workers: 2,
					onCompiled: () => assert.fail("missing input compiled"),
				}),
				/ENOENT/,
			);
			assert.equal(readStoredText(path), checkpoint);
			assert.ok(
				readdirSync(join(f.outputDirectory, "crosswalks")).every(
					(name) => !name.endsWith(".tmp.gz"),
				),
			);
		} finally {
			f.cleanup();
		}
	},
);

test("rejects missing dependencies and duplicate writer IDs before starting workers", async () => {
	const f = crosswalkWorkerFixture();
	try {
		const options = {
			repositoryRoot: f.root,
			outputDirectory: f.outputDirectory,
			workers: 2,
			onCompiled: () => assert.fail("invalid tasks compiled"),
		};
		await assert.rejects(
			compileCrosswalksInWorkers({
				...options,
				adapters: [f.population],
			}),
			/missing dependency/,
		);
		await assert.rejects(
			compileCrosswalksInWorkers({
				...options,
				adapters: [f.area, f.area],
			}),
			/unique IDs/,
		);
	} finally {
		f.cleanup();
	}
});

test(
	"a failing consumer stops all workers and leaves completed checkpoints reusable",
	{ timeout: 15_000 },
	async () => {
		const f = crosswalkWorkerFixture();
		try {
			await assert.rejects(
				compileCrosswalksInWorkers({
					repositoryRoot: f.root,
					outputDirectory: f.outputDirectory,
					adapters: [f.area],
					workers: 2,
					onCompiled: () => {
						throw new Error("consumer failed");
					},
				}),
				/consumer failed/,
			);
			const checkpoint = JSON.parse(
				readStoredText(join(f.outputDirectory, "crosswalks/area.json")),
			);
			assert.equal(checkpoint.id, "area");
		} finally {
			f.cleanup();
		}
	},
);
