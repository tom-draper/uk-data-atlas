import assert from "node:assert/strict";
import test from "node:test";
import {
	compileRelationshipPaths,
	createRelationshipPathIndex,
} from "../src/relationshipPaths";
import { crosswalkInventory } from "./geographyFixtures";

test("publishes only explicit, directional paths with their valid purpose", () => {
	const inventory = compileRelationshipPaths(crosswalkInventory);
	assert.deepEqual(
		inventory.paths.map((path) => ({
			id: path.id,
			purpose: path.purpose,
			from: path.from.geography,
			to: path.to.geography,
		})),
		[
			{
				id: "ward-to-local-authority-2025/forward/membership",
				purpose: "membership",
				from: "ward",
				to: "localAuthority",
			},
			{
				id: "ward-to-local-authority-2025/reverse/membership",
				purpose: "membership",
				from: "localAuthority",
				to: "ward",
			},
		],
	);
	assert.equal(
		createRelationshipPathIndex(inventory)
			.get("ward/2025-01-en-ward/localAuthority/2025-01-uk-lad/membership")
			?.length,
		1,
	);
});

test("refuses undeclared or incompatible multi-step composition", () => {
	assert.throws(
		() =>
			compileRelationshipPaths(crosswalkInventory, [
				{
					id: "unsafe-path",
					purpose: "membership",
					steps: [
						{
							crosswalkId: "ward-to-local-authority-2025",
							direction: "forward",
						},
						{
							crosswalkId: "ward-to-local-authority-2025",
							direction: "forward",
						},
					],
				},
			]),
		/does not start where the previous step ends/,
	);
});

test("uses an official hierarchy lookup as membership rather than identity", () => {
	const inventory = compileRelationshipPaths({
		...crosswalkInventory,
		crosswalks: [
			...crosswalkInventory.crosswalks,
			{
				id: "local-authority-to-country",
				from: {
					geography: "localAuthority",
					boundaryRelease: "2025-01-uk-lad",
				},
				to: { geography: "country", boundaryRelease: "2025-01-uk-country" },
				method: "official-lookup" as const,
				quality: "publisher-supplied" as const,
				relationshipPurpose: "membership" as const,
				weighting: { status: "not-provided" as const },
				recordCount: 1,
				artifact: "crosswalks/local-authority-to-country.json",
				contentHash: "sha256:local-authority-to-country",
			},
		],
	});
	assert.ok(
		inventory.paths.some(
			(path) =>
				path.id === "local-authority-to-country/forward/membership" &&
				path.purpose === "membership",
		),
	);
});
