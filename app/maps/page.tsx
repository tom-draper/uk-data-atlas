'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

export default function MapsPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (map.current) return;
    
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    
    if (!token) {
      setError('Missing NEXT_PUBLIC_MAPBOX_TOKEN environment variable.');
      setLoading(false);
      return;
    }
    
    mapboxgl.accessToken = token;

    if (mapContainer.current) {
      try {
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [-2.5, 53.5],
          zoom: 8
        });

        map.current.on('load', () => {
          console.log('Map loaded successfully');
          setLoading(false);
        });

        map.current.on('error', (e) => {
          console.error('Map error:', e);
          setError(`Map error: ${e.error?.message || 'Unknown error'}`);
          setLoading(false);
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      } catch (err) {
        console.error('Failed to initialize:', err);
        setError(`Failed to initialize map: ${err}`);
        setLoading(false);
      }
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-4">Map Error</h2>
          <p className="text-gray-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="text-lg">Loading map...</div>
        </div>
      )}
      <div 
        ref={mapContainer} 
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
      />
    </div>
  );
}