import { useEffect, useState } from "react";
import { mapWard2023ToGeojson } from "../utils/statsCalculator";
import { Dataset } from "../types";

function useWardDatasets(allDatasets: Dataset[], activeDatasetId: string) {
    const [geojson, setGeojson] = useState<any>();
    const [wardData, setWardData] = useState<any>();
    const [wardResults, setWardResults] = useState<any>();

    useEffect(() => {
        async function load() {
            const [g2024, g2023, g2022, g2021] = await Promise.all([
                fetch('/data/wards/Wards_December_2024_Boundaries_UK_BGC_-2654605954884295357.geojson').then(r => r.json()),
                fetch('/data/wards/Wards_December_2023_Boundaries_UK_BGC_-915726682161155301.geojson').then(r => r.json()),
                fetch('/data/wards/Wards_December_2022_Boundaries_UK_BGC_-898530251172766412.geojson').then(r => r.json()),
                fetch('/data/wards/Wards_December_2021_UK_BGC_2022_-3127229614810050524.geojson').then(r => r.json()),
            ]);

            const activeGeo = activeDatasetId === '2023' ? g2023 :
                activeDatasetId === '2022' ? g2022 :
                    activeDatasetId === '2021' ? g2021 : g2024;
            setGeojson(activeGeo);

            const active = allDatasets.find(d => d.id === activeDatasetId)!;
            let results = active.wardResults;
            let data = active.wardData;

            if (activeDatasetId === '2023') {
                const { wardResults, wardData } = mapWard2023ToGeojson(active, activeGeo);
                results = wardResults;
                data = wardData;
            }

            setWardData(data);
            setWardResults(results);
        }

        load().catch(console.error);
    }, [activeDatasetId, allDatasets]);

    return { geojson, wardData, wardResults };
}