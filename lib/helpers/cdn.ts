import packageJson from "../../package.json";

const PACKAGE_DATA_VERSION = `v${packageJson.version}`;

export const withCDN = (path: string) => {
	if (process.env.NODE_ENV !== "production") {
		return path;
	}

	// External hosts must version their data URLs.
	const base = process.env.NEXT_PUBLIC_DATA_BASE_URL;
	if (base) {
		return `${base}${path}`;
	}

	const version =
		process.env.NEXT_PUBLIC_DATA_VERSION ?? PACKAGE_DATA_VERSION;
	const separator = path.includes("?") ? "&" : "?";
	return `${path}${separator}v=${encodeURIComponent(version)}`;
};
