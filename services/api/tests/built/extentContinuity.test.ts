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

test("never marks a 2010-set constituency as changed, since none did until 2024", () => {
	// The December 2015 file is Great Britain only, and 2024 is a new set.
	const between = inventory.crosswalks.filter(
		(entry) =>
			entry.method === "extent-continuity" &&
			entry.from.geography === "constituency" &&
			entry.from.boundaryRelease >= "2016-12" &&
			entry.to.boundaryRelease <= "2022-12-uk-bgc",
	);
	assert.ok(between.length >= 5);
	for (const entry of between) {
		const crosswalk = artifact(entry);
		if (crosswalk.method !== "extent-continuity") continue;
		const { continuity } = crosswalk.validation;
		// Generalisation can still leave a pair undecided, as when two
		// neighbours each claim a 75 m strip of their shared border; it must
		// never be called a change.
		assert.deepEqual(
			continuity.changedExtent
				.filter(({ relation }) => relation === "changed")
				.map(({ code }) => code),
			[],
			`${entry.id} marks unchanged constituencies as changed`,
		);
		assert.ok(
			continuity.continuousCount >= continuity.sharedCodeCount * 0.99,
			`${entry.id} carries on only ${continuity.continuousCount} of ${continuity.sharedCodeCount}`,
		);
	}
});
