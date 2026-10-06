/**
 * Runs once per Next.js server instance, before it starts accepting requests.
 * See the installed Next.js instrumentation guide.
 */
export async function register() {
	if (process.env.NEXT_RUNTIME !== "nodejs") return;
	const { warmPlacesDirectory } = await import("./lib/places/load");
	await warmPlacesDirectory();
}
