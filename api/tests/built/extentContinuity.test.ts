import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "../../src/crosswalkInventory";

const publicDirectory = new URL("../../public", import.meta.url).pathname;

const read = <T>(path: string) =>
	JSON.parse(readFileSync(join(publicDirectory, path), "utf8")) as T;

const inventory = read<CrosswalkInventory>("crosswalk-inventory.json");
const artifact = (entry: CrosswalkInventory["crosswalks"][number]) =>
	read<CrosswalkArtifact>(entry.artifact);
const endpoints = (entry: CrosswalkInventory["crosswalks"][number]) =>
	`${entry.from.geography}/${entry.from.boundaryRelease}|${entry.to.geography}/${entry.to.boundaryRelease}`;

test("carries a renumbered area only onto a successor an official lookup also names", () => {
	const official = new Map(
		inventory.crosswalks
			.filter(
				(entry) =>
					entry.method === "official-lookup" &&
					(entry.relationshipPurpose ?? "identity") === "identity",
			)
			.map((entry) => [endpoints(entry), entry]),
	);
	let compared = 0;
	for (const entry of inventory.crosswalks) {
		if (entry.method !== "extent-continuity") continue;
		const lookup = official.get(endpoints(entry));
		if (!lookup) continue;
		const successors = new Map(
			artifact(lookup).records.map((record) => [
				record.source.code,
				new Set(record.targets.map((target) => target.code)),
			]),
		);
		for (const record of artifact(entry).records) {
			const [target] = record.targets;
			if (!target || !("match" in target) || target.match !== "recoded")
				continue;
			compared += 1;
			assert.ok(
				successors.get(record.source.code)?.has(target.code),
				`${entry.id}: ${record.source.code} -> ${target.code} is not a successor ${lookup.id} names`,
			);
		}
	}
	assert.ok(compared > 0, "No recoded pair had an official lookup to check");
});
