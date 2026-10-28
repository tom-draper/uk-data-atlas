import assert from "node:assert/strict";
import test from "node:test";
import { publicJson } from "@uk-data-atlas/atlas-runtime/storage";

test("bodies without code-vintage keys serialise unchanged", () => {
	const body = { area: { code: "E08000035" }, note: '"boundaryYea' };
	assert.equal(publicJson(body), JSON.stringify(body));
	assert.equal(publicJson(undefined), undefined);
});

test("code-vintage keys are published as codeYear and codeYears", () => {
	assert.equal(
		publicJson({
			rows: [{ boundaryYear: 2024, value: 1 }],
			partition: { boundaryYears: [2019, 2024] },
			note: "boundaryYear stays in text",
		}),
		JSON.stringify({
			rows: [{ codeYear: 2024, value: 1 }],
			partition: { codeYears: [2019, 2024] },
			note: "boundaryYear stays in text",
		}),
	);
});
