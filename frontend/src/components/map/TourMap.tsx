"use client"

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Popravljanje default ikonice Leaflet-a
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface Keypoint {
    name: string;
    description: string;
    latitude: number;
    longitude: number;
    order: number;
    imageUrl?: string;
}
interface TourMapProps {
    keypoints: Keypoint[];
    onMapClick: (latlng: { lat: number; lng: number }) => void;
    selectedPosition?: { lat: number; lng: number } | null;
}

function MapClickHandler({ onClick }: { onClick?: (latlng: { lat: number; lng: number }) => void }) {
    useMapEvents({
      click(e) {
        if (onClick) {
          onClick(e.latlng);
        }
      },
    });
    return null;
}
export default function TourMap({ keypoints, onMapClick , selectedPosition}: TourMapProps){
    // Izračunavanje centra mape kao prosečne lokacije svih ključnih tačaka
    const defaultCenter: [number, number] = [45.25, 19.84];
    const center: [number, number] =
        keypoints && keypoints.length > 0
        ?   [
                keypoints.reduce((sum, kp) => sum + kp.latitude, 0) / keypoints.length,
                keypoints.reduce((sum, kp) => sum + kp.longitude, 0) / keypoints.length,
            ]
        : defaultCenter;
    // Sortiranje kljucnih tacaka po redosledu biranja
    const sortedPoints = [...keypoints].sort((a, b) => a.order - b.order);
    // Kreiranje niza koordinata za Polyline
    const polylinePositions: [number, number][] = sortedPoints.map((kp) => [
        kp.latitude,
        kp.longitude,
  ]);
    return (
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: "500px", width: "100%" }}
          className="rounded border"
    >
        <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {keypoints.length > 0 && (
        <Polyline
            positions={polylinePositions}
            color="blue"
            weight={3}
            opacity={0.7}
        />
        )}
        {keypoints.map((keypoint, idx) => (
        <Marker
          key={idx}
          position={[keypoint.latitude, keypoint.longitude]}
          icon={icon}
        >
          <Popup>
            <div>
              <h4 className="font-bold">{keypoint.name}</h4>
              <p className="text-sm">{keypoint.description}</p>
              <p className="text-xs text-gray-500">Redosled: {keypoint.order + 1}</p>
            </div>
          </Popup>
        </Marker>
        ))}
        {selectedPosition && (
          <Marker
            position={[selectedPosition.lat, selectedPosition.lng]}
            icon={icon}
          />
        )}
        <MapClickHandler onClick={onMapClick} />
        </MapContainer>
);
}