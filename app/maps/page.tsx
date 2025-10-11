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
    // Prevent multiple initializations
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
          // Minimal styles - perfect for colored zone overlays
          // Options from simplest to most detailed:
          // 'mapbox://styles/mapbox/light-v11' - Clean, minimal (RECOMMENDED)
          // 'mapbox://styles/mapbox/dark-v11' - Dark minimal
          // 'mapbox://styles/mapbox/streets-v12' - Full detail
          // 'mapbox://styles/mapbox/outdoors-v12' - Terrain focus
          // 'mapbox://styles/mapbox/satellite-v9' - Satellite imagery
          style: 'mapbox://styles/mapbox/light-v11',
          center: [-2.5, 53.5],
          zoom: 8,
          // Enable local caching
          // localIdeographFontFamily: false,
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

    // Cleanup function
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []); // Empty dependency array prevents re-runs

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
      {/* {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="text-lg">Loading map...</div>
        </div>
      )} */}
      {/* Controls overlay */}
      <div className="fixed inset-0 z-100 h-full w-full pointer-events-none">
        <div className="absolute top-0 right-0 h-full p-2 pointer-events-auto">
          <div className="bg-[rgba(255,255,255,0.4)] backdrop-blur-sm p-4 rounded-md shadow-md h-[stretch] w-[220px]" >
          </div>
        </div>

        <div className="absolute top-0 left-0 h-full p-2 pointer-events-auto">
          <div className="bg-[rgba(255,255,255,0.4)] backdrop-blur-sm p-4 rounded-md shadow-md h-[stretch] w-[220px]" >
          </div>
        </div>

        <div className="absolute top-0 left-[calc(220px+0.5rem)] h-full p-2 pointer-events-auto">
          <div className="bg-[rgba(255,255,255,0.4)] backdrop-blur-sm p-4 rounded-md shadow-md h-[stretch] w-[220px]" >
          </div>
        </div>


      </div>
      <div 
        ref={mapContainer} 
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
      />
    </div>
  );
}