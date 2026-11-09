import { decodeCompactPayload } from "@uk-data-atlas/catalogue/compactPayload";
import {
	compilePlaceFacts,
	AGE_DATASETS,
} from "@uk-data-atlas/catalogue/place-facts";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildDocsCatalogue } from "./buildDocsCatalogue.ts";
import { writeAtlasPages } from "./atlas/writeAtlasPages.ts";
import { buildPlaceProfiles } from "./places/buildPlaceProfiles.ts";
import type {
	AreaProfile,
	PlaceIndex,
} from "@uk-data-atlas/catalogue/place-profile";
import { buildLog, formatCount } from "@uk-data-atlas/atlas-db";

const ROOT = resolve(import.meta.dirname, "../..");
const readDataset = (output: string) =>
	readFileSync(join(ROOT, "data/build/datasets", `${output}.json`), "utf8");
const { outputs, index } = buildPlaceProfiles(ROOT);

const contentHash = createHash("sha256");
for (const name of [...outputs.keys()].sort())
	contentHash.update(name).update(outputs.get(name)!);
const indexJson = JSON.stringify({
	version: 1,
	contentHash: `sha256:${contentHash.digest("hex")}`,
	...index,
} satisfies PlaceIndex);

const pages = new Map<string, string>([
	["places-index", indexJson],
	["docs-catalogue", buildDocsCatalogue()],
]);
for (const [name, json] of outputs)
	pages.set(
		`places-${name
			.replace("areas/", "area-")
			.replace("named/", "named-")
			.replace(/\.json$/, "")}`,
		json,
	);
const readEditions = (name: string) =>
	decodeCompactPayload(JSON.parse(readDataset(name))) as Parameters<
		typeof compilePlaceFacts
	>[1];
pages.set(
	"place-facts",
	JSON.stringify(
		compilePlaceFacts(
			AGE_DATASETS.map(readEditions),
			readEditions("ethnicity"),
		),
	),
);
const wardAreas: Record<string, number> = {};
for (const [name, json] of outputs) {
	if (!name.startsWith("areas/")) continue;
	for (const [code, profile] of Object.entries(
		JSON.parse(json) as Record<string, AreaProfile>,
	))
		if (
			/^[EW]05/.test(code) &&
			profile.geography === "ward" &&
			profile.areaKm2
		)
			wardAreas[code] = profile.areaKm2;
}
pages.set("ward-areas", JSON.stringify(wardAreas));
writeAtlasPages(ROOT, pages);
buildLog.info(`Wrote ${formatCount(pages.size)} atlas page artifacts`);
