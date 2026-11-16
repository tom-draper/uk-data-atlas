import { route } from "../contract/servedContract";
import { mapResourceArchiveMetadata } from "./mapResourceArchiveMetadata";
import { mapResourceFeaturesMetadata } from "./mapResourceFeaturesMetadata";
import { mapResourceJoinMetadata } from "./mapResourceJoinMetadata";
import { mapResourceMetadata } from "./mapResourceMetadata";
import { mapResourceTileJsonMetadata } from "./mapResourceTileJsonMetadata";
import { mapResourceTileMetadata } from "./mapResourceTileMetadata";
import { mapResourcesMetadata } from "./mapResourcesMetadata";

const resource = "/map-resources/:geography/:release";

export const mapResourcesContract = route(
	"get",
	"/map-resources",
	mapResourcesMetadata,
);
export const mapResourceContract = route("get", resource, mapResourceMetadata);
export const mapResourceTileJsonContract = route(
	"get",
	`${resource}/tiles.json`,
	mapResourceTileJsonMetadata,
);
export const mapResourceFeaturesContract = route(
	"get",
	`${resource}/features`,
	mapResourceFeaturesMetadata,
);
export const mapResourceTileContract = route(
	"get",
	`${resource}/tiles/:z/:x/:y.mvt`,
	mapResourceTileMetadata,
);
export const mapResourceJoinContract = route(
	"get",
	`${resource}/join/:measureId`,
	mapResourceJoinMetadata,
);
export const mapResourceArchiveContract = route(
	"get",
	`${resource}.pmtiles`,
	mapResourceArchiveMetadata,
);
