/** Format human-readable chart headings while preserving acronyms and figures. */
export function toChartTitleCase(value: string): string {
	return value
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/[A-Za-zÀ-ÖØ-öø-ÿ0-9]+/g, (word) => {
			if (word === word.toUpperCase()) return word;
			return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
		});
}
