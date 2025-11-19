'use client';

import { useState } from 'react';
//@ts-ignore
import 'mapbox-gl/dist/mapbox-gl.css';
import MapInterface from '@components/MapInterface';
import ErrorDisplay from '@/components/displays/ErrorDisplay';
import LoadingDisplay from '@/components/displays/LoadingDisplay';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useDatasets } from '@/lib/hooks/useDatasets';

export default function MapsPage() {
    const [activeDatasetId, setActiveDatasetId] = useState('local-election-2024');
    const [selectedLocation, setSelectedLocation] = useState('Greater Manchester');

    const { datasets, loading, errors } = useDatasets();

    if (loading) return <LoadingDisplay />;
    if (errors.length > 0) return <ErrorDisplay message={errors[0]} />;

    return (
        <ErrorBoundary>
            <MapInterface
                datasets={datasets}
                selectedLocation={selectedLocation}
                setSelectedLocation={setSelectedLocation}
                activeDatasetId={activeDatasetId}
                setActiveDatasetId={setActiveDatasetId}
            />
        </ErrorBoundary>
    );
}