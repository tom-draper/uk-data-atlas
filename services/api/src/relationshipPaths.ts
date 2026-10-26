import type {
	RelationshipPath,
	RelationshipPathInventory,
} from "../../../shared/relationshipPaths";
export * from "../../../shared/relationshipPaths";

export const createRelationshipPathIndex = (
	inventory: RelationshipPathInventory,
) => {
	const index = new Map<string, RelationshipPath[]>();
	for (const path of inventory.paths) {
		const key = [
			path.from.geography,
			path.from.boundaryRelease,
			path.to.geography,
			path.to.boundaryRelease,
			path.purpose,
		].join("/");
		const paths = index.get(key) ?? [];
		paths.push(path);
		index.set(key, paths);
	}
	return index;
};
