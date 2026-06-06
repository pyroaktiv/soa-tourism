'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  getTour,
  startExecution,
  heartbeatExecution,
  abandonExecution,
  getExecution,
} from '@/lib/services/tourService';
import { getPosition, updatePosition } from '@/lib/services/simulatorService';
import { getUser } from '@/lib/auth';
import RoleGuard from '@/components/auth/RoleGuard';

const TourMap = dynamic(() => import('@/components/map/TourMap'), {
  ssr: false,
  loading: () => <div className="p-10 text-center text-gray-500">Učitavanje mape...</div>,
});

const storageKey = (tourId: string) => `tour_execution_${tourId}`;

export default function TourExecutionPage() {
  const { id } = useParams() as { id: string };
  const [tour, setTour] = useState<any>(null);
  const [execution, setExecution] = useState<any>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentUser = getUser();
  const isTourist = currentUser?.roles?.includes('tourist');
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const tourData = await getTour(id);
        setTour(tourData);
      } catch (err) {
        setTour(null);
      }

      try {
        const savedPosition = await getPosition();
        if (savedPosition?.latitude && savedPosition?.longitude) {
          setPosition({ lat: savedPosition.latitude, lng: savedPosition.longitude });
        }
      } catch (err) {
        // Simulator position may not exist yet.
      }

      if (typeof window !== 'undefined') {
        const storedExecutionId = window.localStorage.getItem(storageKey(id));
        if (storedExecutionId) {
          try {
            const executionData = await getExecution(storedExecutionId);
            setExecution(executionData);
          } catch (err) {
            window.localStorage.removeItem(storageKey(id));
          }
        }
      }

      setLoading(false);
    };

    load();
  }, [id]);

  useEffect(() => {
    if (execution?.status !== 'started') {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = window.setInterval(async () => {
      try {
        const current = await getPosition();
        if (current?.latitude && current?.longitude) {
          const updatedPosition = { lat: current.latitude, lng: current.longitude };
          setPosition(updatedPosition);
          const response = await heartbeatExecution(
            execution.id,
            current.latitude,
            current.longitude
          );
          setExecution(response.execution ?? response);

          if (response.newlyVisited) {
            const pointName = (response.execution ?? response).visitedKeypoints?.find((kp: any) => kp.order === response.visitedOrder)?.name;
            setMessage(pointName ? `Čestitamo — prešli ste ključnu tačku ${response.visitedOrder + 1}: ${pointName}` : `Čestitamo — prešli ste ključnu tačku ${response.visitedOrder + 1}`);
          }
          if ((response.execution ?? response).status === 'completed') {
            setMessage('Svaka čast! Završili ste turu.');
          }
        }
      } catch (err) {
        // ignore intermittent polling errors
      }
    }, 10000);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [execution?.id, execution?.status]);

  const saveExecution = (executionData: any | null) => {
    setExecution(executionData);
    if (typeof window === 'undefined') return;
    if (executionData && executionData.id && executionData.status === 'started') {
      window.localStorage.setItem(storageKey(id), executionData.id);
    } else {
      window.localStorage.removeItem(storageKey(id));
    }
  };

  const remainingKeypoints = useMemo(() => {
    const visitedOrders = new Set(execution?.visitedKeypoints?.map((kp: any) => kp.order) ?? []);
    return (tour?.keypoints ?? [])
      .filter((kp: any) => !visitedOrders.has(kp.order))
      .sort((a: any, b: any) => a.order - b.order);
  }, [tour, execution]);

  const nextKeypoint = remainingKeypoints[0] ?? null;
  const mapKeypoints = execution ? remainingKeypoints : tour?.keypoints ?? [];
  const progressLabel = execution
    ? `${execution.visitedKeypoints?.length ?? 0}/${tour?.keypoints?.length ?? 0}`
    : `0/${tour?.keypoints?.length ?? 0}`;

  const handleMapClick = async (latlng: { lat: number; lng: number }) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updatePosition(latlng.lat, latlng.lng);
      setPosition(latlng);
      if (execution?.status === 'started') {
        const response = await heartbeatExecution(execution.id, latlng.lat, latlng.lng);
        saveExecution(response.execution ?? response);

        if (response.newlyVisited) {
          const pointName = (response.execution ?? response).visitedKeypoints?.find((kp: any) => kp.order === response.visitedOrder)?.name;
          setMessage(pointName ? `Čestitamo — prešli ste ključnu tačku ${response.visitedOrder + 1}: ${pointName}` : `Čestitamo — prešli ste ključnu tačku ${response.visitedOrder + 1}`);
        }
        if ((response.execution ?? response).status === 'completed') {
          setMessage('Svaka čast! Završili ste turu.');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Greška pri ažuriranju simulirane pozicije.');
    } finally {
      setSaving(false);
    }
  };

  const handleStart = async () => {
    if (!isTourist) return alert('Samo turisti mogu pokretati izvršenja.');
    if (!position) return alert('Prvo kliknite na mapu da odredite svoju simuliranu poziciju.');

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const started = await startExecution(id, position.lat, position.lng);
      saveExecution(started);
      setMessage(`Tura je započeta. Idite do prve ključne tačke: ${nextKeypoint?.name ?? '...'}.`);
    } catch (err: any) {
      setError(err?.message || 'Neuspeh pri pokretanju izvršenja.');
    } finally {
      setSaving(false);
    }
  };

  const handleAbandon = async () => {
    if (!execution) return;
    if (!confirm('Da li ste sigurni da želite da prekinete izvršenje?')) return;

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await abandonExecution(execution.id);
      saveExecution(response.execution ?? response);
      setMessage('Izvršenje je prekinuto.');
    } catch (err: any) {
      setError(err?.message || 'Neuspeh pri prekidanju izvršenja.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center mt-10">Učitavanje...</div>;
  }

  if (!isTourist) {
    return (
      <div className="max-w-4xl mx-auto mt-10 p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-4">Pristup odbijen</h1>
        <p>Ovo mesto je rezervisano za turiste koji su kupili turu.</p>
      </div>
    );
  }

  if (!tour) {
    return <div className="text-center mt-10">Tura nije pronađena.</div>;
  }

  return (
    <RoleGuard allowedRoles={["tourist"]}>
      <div className="max-w-6xl mx-auto mt-10 pb-20">
        <div className="bg-white p-8 rounded-lg shadow border mb-8">
          <h1 className="text-3xl font-bold mb-4">Izvršenje ture</h1>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-lg font-semibold">{tour.name}</p>
              <p className="text-gray-600 mt-2">{tour.description}</p>
            </div>
            <div className="text-sm text-gray-500">
              <p>Ukupno ključnih tačaka: {tour?.keypoints?.length ?? 0}</p>
              <p>Napredak: {progressLabel}</p>
            </div>
            <div className="text-sm text-gray-500">
              {position ? (
                <>
                  <p>Sim. pozicija:</p>
                  <p>Lat: {position.lat.toFixed(6)}</p>
                  <p>Lng: {position.lng.toFixed(6)}</p>
                </>
              ) : (
                <p>Sim. pozicija nije definisana.</p>
              )}
            </div>
          </div>
        </div>

        <div className="lg:grid lg:grid-cols-[1.55fr_0.85fr] lg:gap-8">
          <div className="sticky top-20 h-[calc(100vh-120px)]">
            <div className="bg-white p-4 rounded-lg shadow border h-full overflow-hidden">
              <div className="flex items-center justify-between mb-4 gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">Simulator mape</h2>
                  <p className="text-gray-600 text-sm mt-1">
                    Kliknite na mapu da pomerite svoju simuliranu poziciju i idite do sledeće ključne tačke.
                  </p>
                </div>
                {nextKeypoint && (
                  <div className="rounded-lg border px-3 py-2 text-sm text-gray-700 bg-gray-50">
                    <p className="font-semibold">Sledeća tačka</p>
                    <p>{nextKeypoint.name}</p>
                  </div>
                )}
              </div>
              <TourMap
                keypoints={mapKeypoints}
                onMapClick={handleMapClick}
                selectedPosition={position}
                nextKeypoint={nextKeypoint}
                height="calc(100vh - 240px)"
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow border">
              <h2 className="text-2xl font-semibold mb-4">Status ture</h2>
              <p className="text-sm text-gray-500">Status</p>
              <p className="text-xl font-semibold capitalize mt-1">
                {execution?.status ?? 'nije započeto'}
              </p>
              {message && execution?.status !== 'completed' && (
                <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-4 text-green-800">
                  {message}
                </div>
              )}
              {error && (
                <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-4 text-red-800">
                  {error}
                </div>
              )}
              <div className="mt-6 space-y-3">
                {!execution ? (
                  <button
                    onClick={handleStart}
                    disabled={saving}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded"
                  >
                    {saving ? 'Pokretanje...' : 'Pokreni izvršenje'}
                  </button>
                ) : execution.status === 'started' ? (
                  <>
                    <button
                      onClick={handleAbandon}
                      disabled={saving}
                      className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded"
                    >
                      {saving ? 'Prekidanje...' : 'Prekini izvršenje'}
                    </button>
                    <p className="text-sm text-gray-500">
                      Simulator će slati poziciju svakih 10 sekundi i automatski proveravati sledeću tačku.
                    </p>
                  </>
                ) : execution.status === 'completed' ? (
                  <div className="space-y-4">
                    <div className="rounded-3xl border border-blue-200 bg-gradient-to-r from-sky-50 via-blue-50 to-cyan-50 p-6 text-blue-900 shadow-sm">
                      <p className="text-lg font-semibold">Svaka čast, turu ste završili!</p>
                      <p className="mt-2 text-sm text-blue-700">
                        Sada možete da se vratite na stranicu ture ili ponovo pokrenete novu avanturu.
                      </p>
                    </div>
                    <Link
                      href={`/tours/${id}`}
                      className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded"
                    >
                      Nazad na turu
                    </Link>
                  </div>
                ) : (
                  <p className="text-gray-600">Izvršenje je završeno ili prekinuto. Osvežite stranicu za najnovije stanje.</p>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border">
              <h2 className="text-2xl font-semibold mb-4">Posete ključnim tačkama</h2>
              {execution?.visitedKeypoints?.length ? (
                <div className="space-y-3">
                  {execution.visitedKeypoints.map((kp: any) => (
                    <div key={kp.order} className="rounded-lg border p-4">
                      <p className="font-bold">{kp.order + 1}. {kp.name}</p>
                      <p className="text-sm text-gray-500">Poseto: {kp.visitedAt}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600">Još nije posetio nijednu tačku.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
