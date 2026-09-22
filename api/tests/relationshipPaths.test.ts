import assert from "node:assert/strict";
import test from "node:test";
import type { CrosswalkInventory } from "../src/crosswalkInventory";
import {
	compileRelationshipPaths,
	createRelationshipPathIndex,
	type CrosswalkShape,
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
		createRelationshipPathIndex(inventory).get(
			"ward/2025-01-en-ward/localAuthority/2025-01-uk-lad/membership",
		)?.length,
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
				to: {
					geography: "country",
					boundaryRelease: "2025-01-uk-country",
				},
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

type Summary = CrosswalkInventory["crosswalks"][number];

// A small hierarchy with one change of vintage. Ward W1 nests in authority
// release L1, which reaches L2 one-to-one by same code and L3 by a merge;
// L2 nests in region R. Constituency C overlaps L2, and L1 reaches L4 by an
// official lookup that splits as well as merges.
const edge = (
	id: string,
	from: string,
	to: string,
	method: Summary["method"],
	quality: Summary["quality"],
	relationshipPurpose?: Summary["relationshipPurpose"],
): Summary => {
	const endpoint = (value: string) => {
		const [geography, boundaryRelease] = value.split("/") as [
			string,
			string,
		];
		return { geography, boundaryRelease };
	};
	return {
		id,
		from: endpoint(from),
		to: endpoint(to),
		method,
		quality,
		...(relationshipPurpose ? { relationshipPurpose } : {}),
		weighting:
			method === "area-overlap"
				? {
						status: "provided",
						basis: "area",
						normalisation: "per-source",
					}
				: { status: "not-applicable" },
		recordCount: 1,
		artifact: `crosswalks/${id}.json`,
		contentHash: `sha256:${id}`,
	};
};

const graph: CrosswalkInventory = {
	schemaVersion: 1,
	contentHash: "sha256:graph",
	crosswalks: [
		edge(
			"w1-l1",
			"ward/1",
			"authority/1",
			"clean-containment",
			"publisher-supplied",
		),
		edge(
			"l1-l2",
			"authority/1",
			"authority/2",
			"same-code-continuity",
			"derived",
			"identity",
		),
		edge(
			"l1-l3",
			"authority/1",
			"authority/3",
			"official-lookup",
			"publisher-supplied",
		),
		edge(
			"l1-l4",
			"authority/1",
			"authority/4",
			"official-lookup",
			"publisher-supplied",
		),
		edge(
			"l2-r",
			"authority/2",
			"region/1",
			"official-lookup",
			"publisher-supplied",
			"membership",
		),
		edge(
			"c-l2",
			"constituency/1",
			"authority/2",
			"area-overlap",
			"derived",
		),
	],
};

const shapes = new Map<string, CrosswalkShape>([
	["w1-l1", { forward: true, reverse: false }],
	["l1-l2", { forward: true, reverse: true }],
	["l1-l3", { forward: true, reverse: false }],
	["l1-l4", { forward: false, reverse: false }],
	["l2-r", { forward: true, reverse: false }],
	["c-l2", { forward: false, reverse: false }],
]);

const discovered = () =>
	compileRelationshipPaths(graph, [], {
		shapes,
		maximumSteps: 8,
	}).paths.filter((path) => path.origin === "discovered");

const route = (from: string, to: string, purpose: string) =>
	discovered()
		.find(
			(path) =>
				`${path.from.geography}/${path.from.boundaryRelease}` ===
					from &&
				`${path.to.geography}/${path.to.boundaryRelease}` === to &&
				path.purpose === purpose,
		)
		?.steps.map((step) => `${step.crosswalkId} ${step.direction}`);

test("composes membership across a one-to-one change of vintage, up and down", () => {
	assert.deepEqual(route("ward/1", "region/1", "membership"), [
		"w1-l1 forward",
		"l1-l2 forward",
		"l2-r forward",
	]);
	assert.deepEqual(route("region/1", "ward/1", "membership"), [
		"l2-r reverse",
		"l1-l2 reverse",
		"w1-l1 reverse",
	]);
	const path = discovered().find((candidate) =>
		candidate.id.startsWith("discovered/ward-1-to-region-1"),
	)!;
	assert.equal(path.id, "discovered/ward-1-to-region-1/membership");
	assert.equal(path.quality, "derived");
	assert.deepEqual(
		path.steps.map((step) => step.purpose),
		["membership", "identity", "membership"],
	);
});

test("takes a merge as membership, never identity, and refuses a split", () => {
	// W1 is in L1, which merges into L3: the ward sits within L3.
	assert.deepEqual(route("ward/1", "authority/3", "membership"), [
		"w1-l1 forward",
		"l1-l3 forward",
	]);
	// L2 back to L1 is one-to-one, but L1 on to L3 merges.
	assert.equal(route("authority/2", "authority/3", "identity"), undefined);
	assert.deepEqual(route("authority/2", "authority/3", "membership"), [
		"l1-l2 reverse",
		"l1-l3 forward",
	]);
	// L1 to L4 both splits and merges, so no composition may cross it.
	assert.equal(
		discovered().some((path) =>
			path.steps.some((step) => step.crosswalkId === "l1-l4"),
		),
		false,
	);
});

test("allows one weighted step, followed only by steps up", () => {
	assert.deepEqual(route("constituency/1", "region/1", "apportion"), [
		"c-l2 forward",
		"l2-r forward",
	]);
	assert.deepEqual(route("ward/1", "constituency/1", "apportion"), [
		"w1-l1 forward",
		"l1-l2 forward",
		"c-l2 reverse",
	]);
	// Listing down after a weighted step would pretend the weight splits.
	assert.equal(route("constituency/1", "ward/1", "apportion"), undefined);
	assert.equal(route("constituency/1", "ward/1", "membership"), undefined);
});

test("leaves a pair to its crosswalk or declared path, within the step limit", () => {
	// Ward to authority 1 is a published crosswalk.
	assert.equal(route("ward/1", "authority/1", "membership"), undefined);
	const withCounty: CrosswalkInventory = {
		...graph,
		crosswalks: [
			...graph.crosswalks,
			edge(
				"l1-k",
				"authority/1",
				"county/1",
				"clean-containment",
				"publisher-supplied",
			),
		],
	};
	const paths = compileRelationshipPaths(
		withCounty,
		[
			{
				id: "reviewed-ward-to-county",
				purpose: "membership",
				steps: [
					{ crosswalkId: "w1-l1", direction: "forward" },
					{ crosswalkId: "l1-k", direction: "forward" },
				],
			},
		],
		{
			shapes: new Map([
				...shapes,
				["l1-k", { forward: true, reverse: false }],
			]),
			maximumSteps: 8,
		},
	).paths.filter(
		(path) =>
			path.from.geography === "ward" &&
			path.to.geography === "county" &&
			path.purpose === "membership",
	);
	assert.deepEqual(
		paths.map((path) => [path.id, path.origin]),
		[["reviewed-ward-to-county", "declared"]],
	);
	const limited = compileRelationshipPaths(graph, [], {
		shapes,
		maximumSteps: 2,
	}).paths;
	assert.equal(
		limited.some(
			(path) =>
				path.to.geography === "region" &&
				path.from.geography === "ward",
		),
		false,
	);
	assert.ok(
		limited.some(
			(path) => path.id === "discovered/ward-1-to-authority-2/membership",
		),
	);
});

test("keeps an apportion path for each weighting basis", () => {
	const both: CrosswalkInventory = {
		...graph,
		crosswalks: [
			...graph.crosswalks,
			edge(
				"c-l2-people",
				"constituency/1",
				"authority/2",
				"population-overlap",
				"derived",
			),
		],
	};
	const paths = compileRelationshipPaths(both, [], {
		shapes: new Map([
			...shapes,
			["c-l2-people", { forward: false, reverse: false }],
		]),
		maximumSteps: 8,
	}).paths.filter((path) =>
		path.id.startsWith("discovered/constituency-1-to-region-1/"),
	);
	assert.deepEqual(
		paths.map((path) => [path.id, path.steps[0]?.crosswalkId]),
		[
			["discovered/constituency-1-to-region-1/apportion/by-area", "c-l2"],
			[
				"discovered/constituency-1-to-region-1/apportion/by-population",
				"c-l2-people",
			],
		],
	);
});
