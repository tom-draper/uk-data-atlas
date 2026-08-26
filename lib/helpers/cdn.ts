const CDN_REPOSITORY = "tom-draper/uk-data-atlas";

export const withCDN = (path: string) => {
	if (process.env.NODE_ENV === "production") {
		const version = process.env.NEXT_PUBLIC_DATA_VERSION;
		if (!version) {
			throw new Error(
				"NEXT_PUBLIC_DATA_VERSION must be set for production CDN data URLs.",
			);
		}
		return `https://cdn.jsdelivr.net/gh/${CDN_REPOSITORY}@${version}${path}`;
	}
	return path;
};
