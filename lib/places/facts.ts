import { fetchAtlasPage } from "@/lib/helpers/atlasApi";
import type { PlaceFacts } from "@uk-data-atlas/catalogue/place-facts";
export * from "@uk-data-atlas/catalogue/place-facts";
export async function placeFacts(code: string): Promise<PlaceFacts> {
	const facts =
		await fetchAtlasPage<Record<string, PlaceFacts>>("place-facts");
	return facts[code] ?? {};
}
