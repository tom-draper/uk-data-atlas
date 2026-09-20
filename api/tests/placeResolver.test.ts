import assert from "node:assert/strict";
import test from "node:test";
import { createAreaLookup } from "../src/areaInventory";
import {
	createPlaceIndex,
	normalisePlaceName,
	parsePlaceReference,
	resolvePlaces,
} from "../src/placeResolver";
import type { NamedLocationInventory } from "../src/namedLocations";

const release = (
	geography: string,
	boundaryRelease: string,
	areas: { code: string; name: string; aliases?: string[] }[],
) => ({
	schemaVersion: 1 as const,
	contentHash: `sha256:${geography}-${boundaryRelease}`,
	geography,
	boundaryRelease,
	codeProperty: "CODE",
	nameProperty: "NAME",
	areas,
});

const areaLookup = createAreaLookup([
	release("localAuthority", "2021-12-uk-bgc", [
		{ code: "E08000003", name: "Manchester" },
		{ code: "E06000023", name: "Bristol, City of" },
	]),
	release("localAuthority", "2023-05-uk-bgc-v2", [
		{ code: "E08000003", name: "Manchester" },
		{ code: "E06000023", name: "Bristol, City of" },
		{ code: "W06000001", name: "Isle of Anglesey", aliases: ["Ynys Môn"] },
		{ code: "E09000027", name: "Richmond upon Thames" },
		{ code: "E06000043", name: "Brighton and Hove" },
	]),
	release("ward", "2023-05-uk-bgc", [
		{ code: "E05000001", name: "Richmond" },
		{ code: "E05000002", name: "Manchester" },
	]),
	release("majorTownAndCity", "2015-12-en-bgc", [
		{ code: "J01000001", name: "Manchester" },
	]),
]);

const namedLocations = {
	schemaVersion: 1,
	contentHash: "sha256:locations",
	source: {
		artifact: "data/precompiled/gazetteer.core.json",
		gazetteerVersion: 1,
	},
	locations: [
		{
			id: "greater-manchester",
			label: "Greater Manchester",
			kind: "editorial-grouping",
			memberGeography: "localAuthority",
			memberCodes: ["E08000003"],
			bbox: [-2.5, 53.3, -2, 53.7],
		},
	],
} as unknown as NamedLocationInventory;

const index = createPlaceIndex(areaLookup, namedLocations);
const places = (query: string, limit?: number) =>
	resolvePlaces(index, query, limit).map((candidate) => candidate.place);

test("sets aside case, accents, punctuation and the ampersand", () => {
	assert.equal(normalisePlaceName("Brighton & Hove"), "brighton and hove");
	assert.equal(normalisePlaceName("Ynys Môn"), "ynys mon");
	assert.equal(normalisePlaceName("  King's   Lynn "), "kings lynn");
});

test("reads a place reference, and rejects anything else", () => {
	assert.deepEqual(parsePlaceReference("localAuthority/E08000003"), {
		kind: "area",
		geography: "localAuthority",
		code: "E08000003",
	});
	assert.deepEqual(parsePlaceReference("location/north-west"), {
		kind: "named-location",
		geography: "named-location",
		code: "north-west",
	});
	assert.equal(parsePlaceReference("North West"), undefined);
	assert.equal(parsePlaceReference("a/b/c"), undefined);
});

test("returns every place a name means, headline geographies first", () => {
	// Manchester is an authority, a major town and a ward: all three come
	// back, and none is chosen.
	assert.deepEqual(places("Manchester"), [
		"localAuthority/E08000003",
		"majorTownAndCity/J01000001",
		"ward/E05000002",
	]);
});

test("returns a place once however many releases carry it", () => {
	const [manchester] = resolvePlaces(index, "Manchester");
	assert.equal(manchester!.place, "localAuthority/E08000003");
	assert.deepEqual(manchester!.boundaryReleases, [
		"2023-05-uk-bgc-v2",
		"2021-12-uk-bgc",
	]);
});

test("matches a name once its administrative title is set aside", () => {
	const [bristol] = resolvePlaces(index, "Bristol");
	assert.equal(bristol!.place, "localAuthority/E06000023");
	assert.equal(bristol!.match, "exact-without-title");
	assert.equal(bristol!.name, "Bristol, City of");
});

test("matches an alias, and says it was the alias that matched", () => {
	const [anglesey] = resolvePlaces(index, "Ynys Mon");
	assert.equal(anglesey!.place, "localAuthority/W06000001");
	assert.equal(anglesey!.name, "Isle of Anglesey");
	assert.equal(anglesey!.matchedLabel, "Ynys Môn");
});

test("lists names beginning with the query after names equal to it", () => {
	const richmond = resolvePlaces(index, "Richmond");
	assert.deepEqual(
		richmond.map((candidate) => [candidate.place, candidate.match]),
		[
			["ward/E05000001", "exact"],
			["localAuthority/E09000027", "prefix"],
		],
	);
});

test("finds a curated location by its label and keeps its member codes", () => {
	const [location] = resolvePlaces(index, "greater manchester");
	assert.equal(location!.place, "location/greater-manchester");
	assert.equal(location!.kind, "named-location");
	assert.equal(location!.memberGeography, "localAuthority");
	assert.deepEqual(location!.memberCodes, ["E08000003"]);
});

test("looks up a place reference and a bare area code directly", () => {
	assert.deepEqual(places("location/greater-manchester"), [
		"location/greater-manchester",
	]);
	assert.deepEqual(places("e08000003"), ["localAuthority/E08000003"]);
});

test("finds nothing for an unknown name, and does not prefix-match fragments", () => {
	assert.deepEqual(places("Atlantis"), []);
	assert.deepEqual(places(""), []);
	// Two letters would match half the country.
	assert.deepEqual(places("Ma"), []);
});

test("stops at the limit", () => {
	assert.equal(places("Manchester", 2).length, 2);
});
