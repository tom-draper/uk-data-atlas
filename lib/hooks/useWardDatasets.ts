import { useEffect, useState } from 'react';
import type { Dataset } from '@/lib/types';

export function useWardDatasets(allDatasets: Dataset[], activeDatasetId: string, populationDatasets: any[]) {
    const [geojson, setGeojson] = useState<any | null>(null);
    const [wardData, setWardData] = useState<any | null>(null);
    const [wardResults, setWardResults] = useState<any | null>(null);
    const [wardNameToPopCode, setWardNameToPopCode] = useState<{ [k: string]: string }>({});

    useEffect(() => {
        console.log('useWardDatasets', activeDatasetId)
        let cancelled = false;

        async function loadAll() {
            const [geojson2024, geojson2023, geojson2022, geojson2021] = await Promise.all([
                fetch('/data/wards/Wards_December_2024_Boundaries_UK_BGC_-2654605954884295357.geojson').then(r => r.json()),
                fetch('/data/wards/Wards_December_2023_Boundaries_UK_BGC_-915726682161155301.geojson').then(r => r.json()),
                fetch('/data/wards/Wards_December_2022_Boundaries_UK_BGC_-898530251172766412.geojson').then(r => r.json()),
                fetch('/data/wards/Wards_December_2021_UK_BGC_2022_-3127229614810050524.geojson').then(r => r.json()),
            ]);

            const activeGeo = activeDatasetId === '2023' ? geojson2023
                : activeDatasetId === '2022' ? geojson2022
                    : activeDatasetId === '2021' ? geojson2021
                        : geojson2024;

            if (cancelled) return;
            setGeojson(activeGeo);

            const dataset2024 = allDatasets.find(d => d.id === '2024');
            const dataset2023 = allDatasets.find(d => d.id === '2023');
            const dataset2022 = allDatasets.find(d => d.id === '2022');
            const dataset2021 = allDatasets.find(d => d.id === '2021');

            let results2024 = dataset2024?.wardResults || {};
            let data2024 = dataset2024?.wardData || {};
            let results2023 = dataset2023?.wardResults || {};
            let data2023 = dataset2023?.wardData || {};
            let results2022 = dataset2022?.wardResults || {};
            let data2022 = dataset2022?.wardData || {};
            let results2021 = dataset2021?.wardResults || {};
            let data2021 = dataset2021?.wardData || {};

            const activeResults = activeDatasetId === '2023' ? results2023 : activeDatasetId === '2022' ? results2022 : activeDatasetId === '2021' ? results2021 : results2024;
            const activeData = activeDatasetId === '2023' ? data2023 : activeDatasetId === '2022' ? data2022 : activeDatasetId === '2021' ? data2021 : data2024;

            if (cancelled) return;
            setWardData(activeData);
            setWardResults(activeResults);

            console.log(activeData, activeResults, activeGeo)

            // Build ward name -> population code map from active geojson and population dataset
            const mapObj: { [name: string]: string } = {};
            const popCodes = Object.keys(populationDatasets[0]?.populationData || {});
            for (const wardCode of popCodes) {
                const feature = activeGeo.features.find((f: any) =>
                    f.properties.WD23CD === wardCode || f.properties.WD24CD === wardCode || f.properties.WD22CD === wardCode || f.properties.WD21CD === wardCode
                );
                if (feature) {
                    const name = (feature.properties.WD23NM || '').toLowerCase().trim();
                    if (name) mapObj[name] = wardCode;
                }
            }

            setWardNameToPopCode(mapObj);
        }

        loadAll().catch(err => console.error(err));
        return () => { cancelled = true; };
    }, [allDatasets, activeDatasetId, populationDatasets]);

    return { geojson, wardData, wardResults, wardNameToPopCode };
}