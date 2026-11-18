export const UPDATE_CADENCES = [
	"monthly",
	"quarterly",
	"annual",
	"decennial",
	"irregular",
	"discontinued",
] as const;
export type UpdateCadence = (typeof UPDATE_CADENCES)[number];
