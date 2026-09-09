import React, { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";

export interface LeafletMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  onLocationSelect?: (lat: number, lng: number) => void;
  deliveryRadiusKm?: number;
  deliveryRadiusEnabled?: boolean;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  center,
  zoom = 13,
  onLocationSelect,
  deliveryRadiusKm,
  deliveryRadiusEnabled = true,
}) => {
  const MapEvents = () => {
    useMapEvents({
      click(e) {
        if (onLocationSelect) {
          onLocationSelect(e.latlng.lat, e.latlng.lng);
        }
      },
    });
    return null;
  };

  const ChangeView = ({ coords }: { coords: { lat: number; lng: number } }) => {
    const map = useMap();
    useEffect(() => {
      map.setView([coords.lat, coords.lng], zoom);
    }, [coords.lat, coords.lng, map]);
    return null;
  };

  const radiusMeters = deliveryRadiusKm ? deliveryRadiusKm * 1000 : 0;

  return (
    <div className="w-full h-full min-h-[200px] rounded-xl overflow-hidden shadow-inner border border-outline-variant/10 relative z-0">
      {deliveryRadiusEnabled && deliveryRadiusKm && deliveryRadiusKm > 0 && (
        <div className="absolute top-2 right-2 z-[400] bg-surface-container/95 backdrop-blur-md px-2.5 py-1 rounded-lg border border-primary/20 shadow-md flex items-center gap-1.5 pointer-events-none">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-black text-on-surface uppercase tracking-wider">
            {deliveryRadiusKm} KM Delivery Zone
          </span>
        </div>
      )}
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker
          position={[center.lat, center.lng]}
          draggable={true}
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target;
              const position = marker.getLatLng();
              if (onLocationSelect) {
                onLocationSelect(position.lat, position.lng);
              }
            },
          }}
        />
        {deliveryRadiusEnabled && radiusMeters > 0 && (
          <Circle
            center={[center.lat, center.lng]}
            radius={radiusMeters}
            pathOptions={{
              color: "#FF5A36",
              fillColor: "#FF5A36",
              fillOpacity: 0.15,
              weight: 2,
              dashArray: "6, 6",
            }}
          >
            <Tooltip permanent direction="top" offset={[0, -10]}>
              <span className="text-[10px] font-black text-[#FF5A36] uppercase tracking-wider">
                {deliveryRadiusKm} KM Active Zone
              </span>
            </Tooltip>
          </Circle>
        )}
        <MapEvents />
        <ChangeView coords={center} />
      </MapContainer>
    </div>
  );
};
