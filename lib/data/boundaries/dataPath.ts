/**
 * Converts a browser-facing data URL into the path relative to data/ used by
 * build-time loaders. Deployment cache keys must never become part of a local
 * filesystem path.
 */
export const localDataPath = (path: string) => {
	const pathWithoutQuery = path.split(/[?#]/, 1)[0];
	const dataIndex = pathWithoutQuery.indexOf("/data/");
	return pathWithoutQuery.slice(dataIndex + "/data/".length);
};
