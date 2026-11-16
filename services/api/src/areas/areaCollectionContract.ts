import { route } from "../contract/servedContract";
import { areaContainsBatchMetadata } from "./areaContainsBatchMetadata";
import { areaContainsMetadata } from "./areaContainsMetadata";
import { areaIntersectsMetadata } from "./areaIntersectsMetadata";
import { areaNearMetadata } from "./areaNearMetadata";
import { areaValidateMetadata } from "./areaValidateMetadata";
import { areaValidatePostMetadata } from "./areaValidatePostMetadata";
import { areasMetadata } from "./areasMetadata";

export const areasContract = route("get", "/areas", areasMetadata);
export const areaIntersectsContract = route(
	"get",
	"/areas::intersects",
	areaIntersectsMetadata,
);
export const areaContainsContract = route(
	"get",
	"/areas::contains",
	areaContainsMetadata,
);
export const areaNearContract = route("get", "/areas::near", areaNearMetadata);
export const areaValidateContract = route(
	"get",
	"/areas::validate",
	areaValidateMetadata,
);
export const areaValidatePostContract = route(
	"post",
	"/areas::validate",
	areaValidatePostMetadata,
);
export const areaContainsBatchContract = route(
	"post",
	"/areas::containsBatch",
	areaContainsBatchMetadata,
);
