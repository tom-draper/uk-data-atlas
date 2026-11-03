import assert from "node:assert/strict";
import test from "node:test";
import { observationValuesEqual } from "@uk-data-atlas/atlas-runtime/storage";

test("compares observations by content rather than serialized hashes", () => {
	const original =
		'{"contentHash":"first","periods":[{"period":"2021","records":[{"areaCode":"A","value":3,"status":"observed"}]}]}';
	const reordered =
		'{"periods":[{"records":[{"status":"observed","value":3,"areaCode":"A"}],"period":"2021"}],"contentHash":"second"}';
	assert.equal(observationValuesEqual(original, reordered), true);
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
