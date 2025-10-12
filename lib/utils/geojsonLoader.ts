// lib/utils/geojsonLoader.ts
export interface GeoJSONData {
    year: number;
    data: any;
}

const geoJsonCache: Record<number, any> = {};

export const loadGeoJSON = async (year: number): Promise<any> => {
    if (geoJsonCache[year]) {
        return geoJsonCache[year];
    }

    let url: string;
    if (year === 2023) {
        url = '/data/wards/Wards_December_2023_Boundaries_UK_BGC_-915726682161155301.geojson';
    } else {
        url = '/data/wards/Wards_December_2024_Boundaries_UK_BGC_-2654605954884295357.geojson';
    }

    const res = await fetch(url);
    const data = await res.json();
    geoJsonCache[year] = data;
    return data;
};

export const getGeoJSONForDataset = async (datasetId: string): Promise<any> => {
    if (datasetId === '2023') {
        return loadGeoJSON(2023);
    }
    return loadGeoJSON(2024);
};