import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { packNamedLocations } from "../src/namedLocationStorage";
import type { NamedLocationInventory } from "../src/namedLocations";

const directory = resolve(import.meta.dirname, "../public");
const inventory: NamedLocationInventory = JSON.parse(
	readFileSync(resolve(directory, "named-locations.json"), "utf8"),
);
packNamedLocations(directory, inventory);
