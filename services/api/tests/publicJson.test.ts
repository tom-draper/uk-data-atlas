import assert from "node:assert/strict";
import test from "node:test";
import { httpResponse } from "../src/httpResponse";
import { envelope } from "../src/routeResponse";

test("publishes code-year vocabulary without mutating compiled source metadata", () => {
	const source = {
		sourceGeography: { type: "ward", boundaryYear: 2023 },
		boundaryYears: [2023, 2024],
	};
	const answer = httpResponse({ method: "GET", headers: {} }, () => ({
		status: 200,
		body: envelope("release", source),
	}));
	assert.equal(typeof answer.body, "string");
	assert.deepEqual(JSON.parse(String(answer.body)).data, {
		sourceGeography: { type: "ward", codeYear: 2023 },
		codeYears: [2023, 2024],
	});
	assert.equal(source.sourceGeography.boundaryYear, 2023);
});
