import assert from "node:assert/strict";
import test from "node:test";
import {
	readBoundedWholeNumber,
	readFiniteNumber,
} from "../src/queryParameters";

test("reads finite decimal query values and rejects blanks or non-finite values", () => {
	assert.equal(readFiniteNumber("530000.5"), 530000.5);
	assert.equal(readFiniteNumber(null), undefined);
	assert.equal(readFiniteNumber("  "), undefined);
	assert.equal(readFiniteNumber("Infinity"), undefined);
	assert.equal(readFiniteNumber("not-a-number"), undefined);
});

test("reads bounded whole-number query values with a fallback", () => {
	assert.equal(readBoundedWholeNumber(null, 10, 1, 20), 10);
	assert.equal(readBoundedWholeNumber("5", 10, 1, 20), 5);
	assert.equal(readBoundedWholeNumber("0", 10, 1, 20), undefined);
	assert.equal(readBoundedWholeNumber("21", 10, 1, 20), undefined);
	assert.equal(readBoundedWholeNumber("1.0", 10, 1, 20), undefined);
});
