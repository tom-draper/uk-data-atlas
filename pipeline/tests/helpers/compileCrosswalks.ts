import {
	compileCrosswalks as streamCrosswalks,
	createCrosswalkInventory,
} from "../../src/crosswalkCompiler";

export const compileCrosswalks = (
	...args: Parameters<typeof streamCrosswalks>
) => {
	const artifacts = [...streamCrosswalks(...args)];
	return { artifacts, inventory: createCrosswalkInventory(artifacts) };
};
