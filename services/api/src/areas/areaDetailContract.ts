import { route } from "../contract/servedContract";
import { areaChildrenGeometryMetadata } from "./areaChildrenGeometryMetadata";
import { areaChildrenMetadata } from "./areaChildrenMetadata";
import { areaGeometryMetadata } from "./areaGeometryMetadata";
import { areaHistoryMetadata } from "./areaHistoryMetadata";
import { areaMetadata } from "./areaMetadata";
import { areaNeighboursMetadata } from "./areaNeighboursMetadata";
import { areaOverlapMetadata } from "./areaOverlapMetadata";
import { areaParentsMetadata } from "./areaParentsMetadata";
import { areaRelationshipsMetadata } from "./areaRelationshipsMetadata";

const area = "/areas/:geography/:release/:code";

export const areaContract = route("get", area, areaMetadata);
export const areaRelationshipsContract = route(
	"get",
	`${area}/relationships`,
	areaRelationshipsMetadata,
);
export const areaHistoryContract = route(
	"get",
	`${area}/history`,
	areaHistoryMetadata,
);
export const areaParentsContract = route(
	"get",
	`${area}/parents`,
	areaParentsMetadata,
);
export const areaChildrenContract = route(
	"get",
	`${area}/children`,
	areaChildrenMetadata,
);
export const areaChildrenGeometryContract = route(
	"get",
	`${area}/children/geometry`,
	areaChildrenGeometryMetadata,
);
export const areaNeighboursContract = route(
	"get",
	`${area}/neighbours`,
	areaNeighboursMetadata,
);
export const areaOverlapContract = route(
	"get",
	`${area}/overlap`,
	areaOverlapMetadata,
);
export const areaGeometryContract = route(
	"get",
	`${area}/geometry`,
	areaGeometryMetadata,
);
