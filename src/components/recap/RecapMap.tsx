'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { GpsPoint, Split } from '@/types/run';

interface RecapMapProps {
  gpsPoints: GpsPoint[];
  splits: Split[];
  averagePaceSecondsPerKm: number;
}

// Maps pace to a color: fast = green, medium = orange, slow = red
function paceToColor(paceSeconds: number, avgPace: number): string {
  if (paceSeconds <= 0 || !isFinite(paceSeconds)) return '#FF6B35';

  const ratio = paceSeconds / avgPace;
  // ratio < 1 = faster than avg, > 1 = slower
  if (ratio <= 0.9) return '#10B981'; // Fast - green
  if (ratio <= 0.97) return '#34D399'; // Slightly fast - light green
  if (ratio <= 1.03) return '#FF6B35'; // On pace - orange
  if (ratio <= 1.1) return '#F59E0B'; // Slightly slow - yellow
  return '#E63946'; // Slow - red
}

export function RecapMap({ gpsPoints, splits, averagePaceSecondsPerKm }: RecapMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current || gpsPoints.length < 2) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;

    // Calculate bounds (GPS = [lat, lng], Mapbox = [lng, lat])
    let minLat = Infinity,
      maxLat = -Infinity,
      minLng = Infinity,
      maxLng = -Infinity;
    for (const p of gpsPoints) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
      zoom: 14,
      attributionControl: false,
      interactive: true,
    });

    map.on('load', () => {
      // Fit to route bounds
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 50, duration: 0 }
      );

      // Build pace-colored line segments
      const avgPace = averagePaceSecondsPerKm || 360;
      const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];

      for (let i = 1; i < gpsPoints.length; i++) {
        const prev = gpsPoints[i - 1];
        const curr = gpsPoints[i];
        const timeDelta = (curr.timestamp - prev.timestamp) / 1000;
        const distDelta = haversineQuick(prev.lat, prev.lng, curr.lat, curr.lng);

        let segmentPace = avgPace;
        if (timeDelta > 0 && distDelta > 0.5) {
          segmentPace = (timeDelta / distDelta) * 1000;
        }

        features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            // Mapbox uses [lng, lat]
            coordinates: [
              [prev.lng, prev.lat],
              [curr.lng, curr.lat],
            ],
          },
          properties: {
            color: paceToColor(segmentPace, avgPace),
          },
        });
      }

      map.addSource('route-segments', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features,
        },
      });

      map.addLayer({
        id: 'route-segments-line',
        type: 'line',
        source: 'route-segments',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-width': 4,
          'line-color': ['get', 'color'],
          'line-opacity': 0.9,
        },
      });

      // Start marker
      new mapboxgl.Marker({ color: '#10B981', scale: 0.7 })
        .setLngLat([gpsPoints[0].lng, gpsPoints[0].lat])
        .addTo(map);

      // End marker
      const last = gpsPoints[gpsPoints.length - 1];
      new mapboxgl.Marker({ color: '#E63946', scale: 0.7 })
        .setLngLat([last.lng, last.lat])
        .addTo(map);

      // Add split markers
      let cumulativeDistance = 0;
      let splitIndex = 0;
      for (let i = 1; i < gpsPoints.length && splitIndex < splits.length; i++) {
        const prev = gpsPoints[i - 1];
        const curr = gpsPoints[i];
        cumulativeDistance += haversineQuick(prev.lat, prev.lng, curr.lat, curr.lng);

        if (cumulativeDistance >= (splitIndex + 1) * 1000) {
          const el = document.createElement('div');
          el.className = 'split-marker';
          el.textContent = String(splitIndex + 1);
          el.style.cssText =
            'width:20px;height:20px;border-radius:50%;background:#FF6B35;color:white;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;';

          new mapboxgl.Marker({ element: el })
            .setLngLat([curr.lng, curr.lat])
            .addTo(map);

          splitIndex++;
        }
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
    };
  }, [gpsPoints, splits, averagePaceSecondsPerKm]);

  if (gpsPoints.length < 2) return null;

  return (
    <div className="card overflow-hidden p-0">
      <div ref={mapContainer} className="w-full h-52 rounded-2xl" />
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 px-4 py-2 text-xs text-festival-muted">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Fast
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-festival-orange" />
          On pace
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-festival-red" />
          Slow
        </span>
      </div>
    </div>
  );
}

// Quick haversine for segment distance (meters)
function haversineQuick(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
