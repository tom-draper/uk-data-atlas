import assert from "node:assert/strict";
import test from "node:test";
import { parsePostcode } from "@uk-data-atlas/geography";
import { PostcodeResolver } from "@uk-data-atlas/atlas-runtime/areas";
import { postcodeIndexFor, postcodeRow } from "./postcodeFixtures";

test("looks up a postcode without area, geometry or relationship inputs", () => {
	const { index } = postcodeIndexFor([postcodeRow("EC1A 1AA")]);
	const resolver = new PostcodeResolver({ postcodeIndex: index });
	const postcode = parsePostcode("EC1A 1AA");
	assert.equal(postcode?.kind, "unit");
	if (postcode?.kind !== "unit") throw new Error("Expected a unit postcode");
	assert.equal(resolver.postcodeIndex()?.lookup(postcode).status, "found");
	assert.equal(resolver.postcodeAreaIndex(), undefined);
});
