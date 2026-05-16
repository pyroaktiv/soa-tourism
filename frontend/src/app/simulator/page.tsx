// src/app/simulator/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { getPosition, updatePosition } from '@/lib/services/simulatorService';
import RoleGuard from '@/components/auth/RoleGuard';
import dynamic from 'next/dynamic';

const TourMap = dynamic(() => import('@/components/map/TourMap'), {
    ssr: false,
    loading: () => <div className="p-10 text-center text-gray-500">Učitavanje mape...</div>
});

export default function SimulatorPage() {
    const [position, setPosition] = useState<{lat: number, lng: number} | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getPosition()
            .then(data => {
                if (data.latitude && data.longitude) {
                    setPosition({ lat: data.latitude, lng: data.longitude });
                }
            })
            .catch(err => {
                console.log("Nema sačuvane pozicije ili je došlo do greške.");
            })
            .finally(() => setLoading(false));
    }, []);

    const handleMapClick = async (latlng: { lat: number; lng: number }) => {
        setSaving(true);
        try {
            await updatePosition(latlng.lat, latlng.lng);
            setPosition(latlng);
        } catch (err) {
            alert("Greška pri čuvanju pozicije.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="text-center mt-10">Učitavanje mape...</div>;

    return (
        <RoleGuard allowedRoles={['tourist']}>
            <div className="max-w-5xl mx-auto mt-10 pb-20">
                <h1 className="text-3xl font-bold mb-2">Simulator Pozicije</h1>
                <p className="text-gray-600 mb-6">
                    Klikni na mapu da bi simulirao svoju trenutnu GPS lokaciju.
                    Ova lokacija će se koristiti za proveru da li si stigao do ključnih tačaka ture.
                </p>

                <div className="bg-white p-4 rounded-lg shadow-sm border">
                    {position ? (
                        <div className="mb-4 p-4 bg-green-50 text-green-800 border border-green-200 rounded flex justify-between items-center">
                            <div>
                                <span className="block font-bold mb-1">Tvoja trenutna simulirana lokacija:</span>
                                <span className="font-mono text-sm">Lat: {position.lat.toFixed(6)}, Lng: {position.lng.toFixed(6)}</span>
                            </div>
                            {saving && <span className="text-sm font-bold animate-pulse text-green-600">Čuvanje...</span>}
                        </div>
                    ) : (
                        <div className="mb-4 p-4 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded font-medium">
                            🗺️ Trenutna lokacija nije definisana. Klikni bilo gde na mapu da je postaviš!
                        </div>
                    )}

                    <div className={saving ? 'opacity-50 pointer-events-none' : ''}>
                        <TourMap
                            keypoints={[]}
                            onMapClick={handleMapClick}
                            selectedPosition={position}
                        />
                    </div>
                </div>
            </div>
        </RoleGuard>
    );
}