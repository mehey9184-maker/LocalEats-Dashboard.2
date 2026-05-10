import React, { useEffect, useRef } from 'react';
import L, { LeafletEvent } from 'leaflet';
import 'leaflet-routing-machine';
import 'leaflet/dist/leaflet.css';
import { Navigation } from 'lucide-react';
import { DeliveryOrder } from '../types';
import { toast } from 'sonner';

// Fix for default marker icons in Leaflet
// @ts-expect-error - Leaflet icon internals
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapProps {
  riderCoords?: [number, number];
  missions: DeliveryOrder[];
  activeMission?: DeliveryOrder | null;
}

export default function AppMapBackground({ riderCoords, missions, activeMission }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routingRef = useRef<L.Routing.Control | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});

  const center: [number, number] = riderCoords || [-26.2041, 28.0473];

  useEffect(() => {
    if (!mapRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
        center,
        zoom: 13,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        className: 'grayscale invert brightness-75 contrast-125'
      }).addTo(mapInstanceRef.current);
    }

    // Cleanup layer on unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update center smoothly on riderCoords change if not active
  useEffect(() => {
    if (riderCoords && mapInstanceRef.current && !activeMission) {
      mapInstanceRef.current.setView(riderCoords, mapInstanceRef.current.getZoom());
    }
  }, [riderCoords, activeMission]);

  // Handle markers and routing logic
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    // 1. Rider Marker
    if (riderCoords) {
      const riderMarker = L.marker(riderCoords, {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: `<div class="relative"><div class="absolute inset-0 bg-amber-500/20 rounded-full animate-ping scale-[3]"></div><div class="bg-amber-500 text-black p-2 rounded-full shadow-2xl relative z-10 border-2 border-white/20"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-navigation"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg></div></div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        })
      }).addTo(map);
      markersRef.current['rider'] = riderMarker;
    }

    // 2. Mission Markers
    missions.forEach(m => {
      if (!m.latitude || !m.longitude) return;
      const isActive = activeMission?.id === m.id;
      const marker = L.marker([Number(m.latitude), Number(m.longitude)], {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: `<div class="p-2 rounded-xl shadow-2xl transition-all ${isActive ? 'bg-amber-500 text-black scale-125 z-[100]' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${m.order_type === 'delivery' ? '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>' : '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/>'}</svg></div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        })
      }).addTo(map);
      markersRef.current[`mission_${m.id}`] = marker;
    });

    // 3. Routing Engine
    if (activeMission && riderCoords && activeMission.latitude && activeMission.longitude) {
      if (routingRef.current) {
        map.removeControl(routingRef.current);
      }
      
      const control = L.Routing.control({
        waypoints: [
          L.latLng(riderCoords[0], riderCoords[1]),
          L.latLng(Number(activeMission.latitude), Number(activeMission.longitude))
        ],
        routeWhileDragging: false,
        addWaypoints: false,
        draggableWaypoints: false,
        show: false,
        lineOptions: {
          styles: [{ color: '#f59e0b', weight: 6, opacity: 0.8 }],
          extendToWaypoints: true,
          missingRouteTolerance: 10
        },
        // @ts-expect-error - Custom marker factory
        createMarker: () => null,
      }).addTo(map);
      
      control.on('routingerror', (e: LeafletEvent & { error?: { message: string } }) => {
        console.warn("Routing Engine Error:", e.error?.message || "Failed to fetch route");
        toast.error("Live route unavailable. Using direct path.", { id: 'osrm-fallback' });
        const fallbackLine = L.polyline([
          riderCoords,
          [Number(activeMission.latitude), Number(activeMission.longitude)]
        ], { color: '#ef4444', dashArray: '10, 10' }).addTo(map);
        
        control.on('routesfound', () => map.removeLayer(fallbackLine));
      });
      
      routingRef.current = control;
    } else if (routingRef.current) {
      map.removeControl(routingRef.current);
      routingRef.current = null;
    }
  }, [riderCoords, missions, activeMission]);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-zinc-950">
      <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-zinc-950 via-transparent to-zinc-950/40 z-10" />
      <div className="absolute bottom-32 right-6 w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center shadow-2xl z-20 pointer-events-auto">
         <Navigation size={20} className="text-zinc-500" />
      </div>
    </div>
  );
}
