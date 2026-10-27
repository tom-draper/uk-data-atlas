import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { artifactRoot } from "../../../shared/dataLayout";
import { packNamedLocations } from "../src/namedLocationStorage";
import type { NamedLocationInventory } from "../src/namedLocations";

const directory = artifactRoot(resolve(import.meta.dirname, ".."));
const inventory: NamedLocationInventory = JSON.parse(
	readFileSync(resolve(directory, "named-locations.json"), "utf8"),
);
packNamedLocations(directory, inventory);
