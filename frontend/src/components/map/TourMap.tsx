"use client"

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Popravljanje default ikonice Leaflet-a
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const currentLocationIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png",
  iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png",
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
  nextKeypoint?: Keypoint | null;
  height?: string;
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

export default function TourMap({
  keypoints,
  onMapClick,
  selectedPosition,
  nextKeypoint,
  height = "500px",
}: TourMapProps) {
  const defaultCenter: [number, number] = [45.25, 19.84];
  const center: [number, number] =
    keypoints && keypoints.length > 0
      ? [
          keypoints.reduce((sum, kp) => sum + kp.latitude, 0) / keypoints.length,
          keypoints.reduce((sum, kp) => sum + kp.longitude, 0) / keypoints.length,
        ]
      : defaultCenter;

  const sortedPoints = [...keypoints].sort((a, b) => a.order - b.order);
  const polylinePositions: [number, number][] = sortedPoints.map((kp) => [kp.latitude, kp.longitude]);

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height, width: "100%" }}
      className="rounded border"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      {sortedPoints.length > 0 && (
        <Polyline positions={polylinePositions} color="blue" weight={3} opacity={0.7} />
      )}

      {nextKeypoint && selectedPosition && (
        <Polyline
          positions={[
            [selectedPosition.lat, selectedPosition.lng],
            [nextKeypoint.latitude, nextKeypoint.longitude],
          ]}
          color="red"
          weight={4}
          opacity={0.9}
          dashArray="8"
        />
      )}

      {sortedPoints.map((keypoint, idx) => (
        <Marker key={idx} position={[keypoint.latitude, keypoint.longitude]} icon={defaultIcon}>
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
        <Marker position={[selectedPosition.lat, selectedPosition.lng]} icon={currentLocationIcon}>
          <Popup>
            <div>
              <p className="font-semibold">Vaša trenutna lokacija</p>
              <p className="text-sm text-gray-600">Pomerite simulaciju ovde klikom na mapu.</p>
            </div>
          </Popup>
        </Marker>
      )}
      <MapClickHandler onClick={onMapClick} />
    </MapContainer>
  );
}
