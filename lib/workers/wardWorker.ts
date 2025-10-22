// lib/workers/wardWorker.ts
import type { WardGeojson } from '@lib/types';

const GEOJSON_PATHS: Record<string, string> = {
    '2024': '/data/wards/Wards_December_2024_Boundaries_UK_BGC_-2654605954884295357.geojson',
    '2023': '/data/wards/Wards_December_2023_Boundaries_UK_BGC_-915726682161155301.geojson',
    '2022': '/data/wards/Wards_December_2022_Boundaries_UK_BGC_-898530251172766412.geojson',
    '2021': '/data/wards/Wards_December_2021_UK_BGC_2022_-3127229614810050524.geojson',
};

async function fetchGeojson(year: string): Promise<WardGeojson> {
    // Convert relative path to absolute URL (important!)
    const path = GEOJSON_PATHS[year];
    const url = new URL(path, self.location.origin).toString();

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    return res.json();
}

function buildWardNameToPopCodeMap(
    geojson: WardGeojson,
    populationCodes: string[]
): Record<string, string> {
    const map: Record<string, string> = {};
    for (const wardCode of populationCodes) {
        const feature = geojson.features.find(
            f =>
                f.properties.WD24CD === wardCode ||
                f.properties.WD23CD === wardCode ||
                f.properties.WD22CD === wardCode ||
                f.properties.WD21CD === wardCode
        );
        if (feature) {
            const name = (feature.properties.WD23NM || '').toLowerCase().trim();
            if (name) map[name] = wardCode;
        }
    }
    return map;
}

// Handle messages from main thread
self.onmessage = async (event: MessageEvent) => {
    const { year, populationCodes } = event.data;
    try {
        const geojson = await fetchGeojson(year);
        const wardNameToPopCode = buildWardNameToPopCodeMap(geojson, populationCodes);
        // Send back processed data
        self.postMessage({ geojson, wardNameToPopCode });
    } catch (err) {
        self.postMessage({ error: String(err) });
    }
};

export { };
