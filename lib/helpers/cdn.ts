import packageJson from "../../package.json";

const CDN_REPOSITORY = "tom-draper/uk-data-atlas";
const PACKAGE_DATA_VERSION = `v${packageJson.version}`;

export const withCDN = (path: string) => {
	if (process.env.NODE_ENV === "production") {
		const version =
			process.env.NEXT_PUBLIC_DATA_VERSION ?? PACKAGE_DATA_VERSION;
		return `https://cdn.jsdelivr.net/gh/${CDN_REPOSITORY}@${version}${path}`;
	}
	return path;
};
