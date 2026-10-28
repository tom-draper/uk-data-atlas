import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { artifactRoot } from "@uk-data-atlas/atlas-runtime/storage";
import { packNamedLocations } from "@uk-data-atlas/atlas-runtime/places";
import type { NamedLocationInventory } from "@uk-data-atlas/atlas-runtime/places";

const directory = artifactRoot(resolve(import.meta.dirname, ".."));
const inventory: NamedLocationInventory = JSON.parse(
	readFileSync(resolve(directory, "named-locations.json"), "utf8"),
);
packNamedLocations(directory, inventory);
