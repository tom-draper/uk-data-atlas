import { readAtlasPage } from "@/lib/helpers/atlasPages";
import type { PlaceFacts } from "@uk-data-atlas/catalogue/place-facts";
export * from "@uk-data-atlas/catalogue/place-facts";
export async function placeFacts(code: string): Promise<PlaceFacts> {
	const facts =
		await readAtlasPage<Record<string, PlaceFacts>>("place-facts");
	return facts[code] ?? {};
}
