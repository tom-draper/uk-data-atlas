import assert from "node:assert/strict";
import { test } from "vitest";
import { observationValuesEqual } from "@uk-data-atlas/atlas-runtime/storage";

test("compares observations by content rather than serialized hashes", () => {
	const original =
		'{"contentHash":"first","periods":[{"period":"2021","records":[{"areaCode":"A","value":3,"status":"observed"}]}]}';
	const reordered =
		'{"periods":[{"records":[{"status":"observed","value":3,"areaCode":"A"}],"period":"2021"}],"contentHash":"second"}';
	assert.equal(observationValuesEqual(original, reordered), true);
	assert.equal(
		observationValuesEqual(
			'{"periods":[{"period":"2024","records":[{"areaCode":"B","value":2},{"areaCode":"A","value":1}]},{"period":"2023","records":[]}]}',
			'{"periods":[{"period":"2023","records":[]},{"period":"2024","records":[{"areaCode":"A","value":1},{"areaCode":"B","value":2}]}]}',
		),
		true,
	);
	assert.equal(
		observationValuesEqual(
			original,
			reordered.replace('"value":3', '"value":4'),
		),
		false,
	);
	assert.equal(
		observationValuesEqual(
			original,
			reordered.replace('"observed"', '"derived"'),
		),
		false,
	);
});
