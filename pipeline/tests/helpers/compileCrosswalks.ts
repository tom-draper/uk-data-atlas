import {
	compileCrosswalks as streamCrosswalks,
	createCrosswalkInventory,
} from "../../src/relationships/crosswalkCompiler";

export const compileCrosswalks = (
	...args: Parameters<typeof streamCrosswalks>
) => {
	const artifacts = [...streamCrosswalks(...args)];
	return { artifacts, inventory: createCrosswalkInventory(artifacts) };
};
