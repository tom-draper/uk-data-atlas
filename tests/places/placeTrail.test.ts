import { describe, expect, it } from "vitest";
import {
	NATIONS,
	placeTrail,
	regionIn,
	UNITED_KINGDOM,
} from "@/components/places/trail";
import type { NamedRef } from "@/lib/places/profile";

const region: NamedRef = {
	id: "north-west",
	label: "North West",
	kind: "region",
};

describe("placeTrail", () => {
	it("runs from Places through the UK and the nested places to the page", () => {
		expect(placeTrail([NATIONS.E, region], { label: "Salford" })).toEqual([
			{ label: "Places", href: "/places" },
			{ label: "United Kingdom", href: "/places/united-kingdom" },
			{ label: "England", href: "/places/england" },
			{ label: "North West", href: "/places/north-west" },
			{ label: "Salford" },
		]);
	});

	it("skips places it could not find", () => {
		expect(
			placeTrail([undefined, undefined], { label: "Salford" }).map(
				(crumb) => crumb.label,
			),
		).toEqual(["Places", UNITED_KINGDOM.label, "Salford"]);
	});

	it("keeps area crumbs in the order given", () => {
		expect(
			placeTrail(
				[],
				{ label: "Salford", href: "/places/E08000006" },
				{
					label: "Pendlebury",
				},
			).map((crumb) => crumb.label),
		).toEqual(["Places", "United Kingdom", "Salford", "Pendlebury"]);
	});
});

describe("regionIn", () => {
	it("finds the region among a place's named places", () => {
		expect(regionIn([NATIONS.E!, region])).toBe(region);
	});

	it("is undefined when there is none, or no places", () => {
		expect(regionIn([NATIONS.E!])).toBeUndefined();
		expect(regionIn(undefined)).toBeUndefined();
	});
});

describe("NATIONS", () => {
	it("has one nation per area code initial", () => {
		expect(Object.keys(NATIONS).sort()).toEqual(["E", "N", "S", "W"]);
	});
});
