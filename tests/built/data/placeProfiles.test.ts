import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	placeShard,
	type AreaProfile,
	type NamedProfile,
	type PlaceIndex,
} from "@/lib/places/profile";

const PLACES = join(process.cwd(), "public", "data", "datasets", "places");
const index = JSON.parse(
	readFileSync(join(PLACES, "index.json"), "utf8"),
) as PlaceIndex;
const files = new Map(
	["areas", "named"].flatMap((folder) =>
		readdirSync(join(PLACES, folder)).map((name) => [
			`${folder}/${name}`,
			readFileSync(join(PLACES, folder, name), "utf8"),
		]),
	),
);
const shards = new Map<string, Record<string, AreaProfile>>();
const area = (code: string) => {
	const name = `areas/${placeShard(code)}.json`;
	if (!shards.has(name)) shards.set(name, JSON.parse(files.get(name)!));
	return shards.get(name)![code]!;
};

describe("place profiles", () => {
	it("are the files their index was written with", () => {
		const hash = createHash("sha256");
		for (const name of [...files.keys()].sort())
			hash.update(name).update(files.get(name)!);
		expect(`sha256:${hash.digest("hex")}`, "run pnpm places:build").toBe(
			index.contentHash,
		);
	});

	it("hold a profile for every place in the index", () => {
		for (const [code] of index.areas) expect(area(code)?.code).toBe(code);
		for (const [id] of index.named)
			expect(
				(JSON.parse(files.get(`named/${id}.json`)!) as NamedProfile).id,
			).toBe(id);
	});

	it("record Cumberland as formed from three Cumbrian districts", () => {
		const cumberland = area("E06000063");
		const formed = cumberland.timeline.find(
			(event) => event.kind === "formed",
		);
		expect(
			formed && "areas" in formed && formed.areas.map((a) => a.name),
		).toEqual(["Allerdale", "Carlisle", "Copeland"]);
		const carlisle = area("E07000028");
		expect(carlisle.current).toBe(false);
		expect(carlisle.timeline[0]).toMatchObject({
			kind: "ended",
			areas: [{ code: "E06000063" }],
		});
	});

	it("place a ward in its council and constituency", () => {
		const bebington = area("E05000954");
		expect(bebington.parents.map((parent) => parent.name).sort()).toEqual([
			"Birkenhead",
			"Wirral",
		]);
		expect(bebington.outline).toBeDefined();
	});
});
