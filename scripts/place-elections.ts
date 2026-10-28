import { readAtlasPayload } from "@uk-data-atlas/atlas-runtime/storage";
import { join } from "node:path";
import { decodeCompactPayload } from "../lib/data/compactPayload";
import {
	compilePlaceElections,
	type SourceEdition,
} from "../lib/places/elections";
import { readAtlasLookup } from "./atlas-lookups";

export const PLACE_ELECTIONS_PATH = join(
	process.cwd(),
	"public",
	"data",
	"datasets",
	"place-elections.json",
);

/** Each ward's and council's local election results, as the file's text. */
export function serialisePlaceElections() {
	const editions = decodeCompactPayload(
		JSON.parse(readAtlasPayload(process.cwd(), "dataset:local-election")),
	) as Record<string, SourceEdition>;
	const { wardToLad } = JSON.parse(
		readAtlasLookup(process.cwd(), "boundary-mappings.json"),
	) as { wardToLad: Record<string, string> };
	return `${JSON.stringify(
		compilePlaceElections(Object.values(editions), wardToLad),
	)}\n`;
}
