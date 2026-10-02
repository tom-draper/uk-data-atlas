import assert from "node:assert/strict";
import test from "node:test";
import {
	executeTranslationPath,
	type IndexedPathStep,
} from "../src/resolver/translation";
import type { RelationshipPath } from "../src/relationshipPaths";

const path: RelationshipPath = {
	id: "source-to-target",
	purpose: "apportion",
	from: { geography: "source", boundaryRelease: "2025" },
	to: { geography: "target", boundaryRelease: "2025" },
	quality: "publisher-supplied",
	origin: "declared",
	steps: [
		{
			crosswalkId: "source-to-middle",
			direction: "forward",
			method: "area-overlap",
			purpose: "apportion",
		},
		{
			crosswalkId: "middle-to-target",
			direction: "forward",
			method: "area-overlap",
			purpose: "apportion",
		},
	],
};

test("reports first-step and surviving coverage for a partial composed translation", () => {
	const steps = new Map<string, IndexedPathStep["steps"]>([
		[
			"source-to-middle",
			new Map([
				[
					"S1",
					{
						source: { code: "S1", labels: ["Source"] },
						sourceCoverage: 0.8,
						targets: [
							{
								code: "M1",
								labels: ["First middle"],
								weight: 0.5,
							},
							{
								code: "M2",
								labels: ["Missing middle"],
								weight: 0.5,
							},
						],
					},
				],
			]),
		],
		[
			"middle-to-target",
			new Map([
				[
					"M1",
					{
						source: { code: "M1", labels: ["First middle"] },
						targets: [
							{ code: "T1", labels: ["Target"], weight: 0.5 },
						],
					},
				],
			]),
		],
	]);
	const translation = executeTranslationPath(path, "S1", (step) =>
		steps.get(step.crosswalkId),
	);

	assert.deepEqual(translation?.targets, [
		{ code: "T1", labels: ["Target"], weight: 0.25 },
	]);
	assert.equal(translation?.sourceCoverage, 0.8);
	assert.equal(translation?.resolvedCoverage, 0.2);
});
