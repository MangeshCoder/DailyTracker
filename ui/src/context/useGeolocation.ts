// frontend/src/hooks/useGeolocation.ts
// REPLACE entire file

import { useState, useCallback } from 'react';

// ── Office config from .env ───────────────────────────────────────────────────
 const OFFICE_LAT    = parseFloat(import.meta.env.VITE_OFFICE_LAT    ?? '18.603609331275763');
 const OFFICE_LNG    = parseFloat(import.meta.env.VITE_OFFICE_LNG    ?? '73.74756220045437');
 const OFFICE_RADIUS = parseFloat(import.meta.env.VITE_OFFICE_RADIUS ?? '5000');
//const OFFICE_LAT    = parseFloat(import.meta.env.VITE_OFFICE_LAT    ?? '18.7381098, ');
//const OFFICE_LNG    = parseFloat(import.meta.env.VITE_OFFICE_LNG    ?? '73.6716409');
//const OFFICE_RADIUS = parseFloat(import.meta.env.VITE_OFFICE_RADIUS ?? '300');

// Log at module load so you can confirm env vars in console immediately on page load
console.log('[useGeolocation] Office config:', { OFFICE_LAT, OFFICE_LNG, OFFICE_RADIUS });

// ── Haversine formula ─────────────────────────────────────────────────────────
function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (deg: number) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type GeolocationStatus =
  | 'idle' | 'requesting' | 'success' | 'outside'
  | 'denied' | 'unavailable' | 'timeout' | 'error';

export interface GeolocationResult {
  status:       GeolocationStatus;
  latitude:     number | null;
  longitude:    number | null;
  accuracy:     number | null;
  distance:     number | null;
  withinOffice: boolean;
  errorMessage: string;
  requestLocation: () => Promise<{ latitude: number; longitude: number } | null>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useGeolocation(): GeolocationResult {
  const [status,    setStatus]    = useState<GeolocationStatus>('idle');
  const [latitude,  setLatitude]  = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy,  setAccuracy]  = useState<number | null>(null);
  const [distance,  setDistance]  = useState<number | null>(null);
  const [errorMsg,  setErrorMsg]  = useState('');

  const requestLocation = useCallback(
    async (): Promise<{ latitude: number; longitude: number } | null> => {

      if (!navigator.geolocation) {
        setStatus('unavailable');
        setErrorMsg('Your browser does not support location services.');
        return null;
      }

      setStatus('requesting');
      setErrorMsg('');

      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat  = position.coords.latitude;
            const lng  = position.coords.longitude;
            const acc  = position.coords.accuracy;
            const dist = haversineMetres(OFFICE_LAT, OFFICE_LNG, lat, lng);

            // ── Debug log — remove after confirming it works ──────────────
            console.log('[useGeolocation] GPS result:', {
              yourLat:   lat,
              yourLng:   lng,
              accuracy:  `±${Math.round(acc)}m`,
              officeLat: OFFICE_LAT,
              officeLng: OFFICE_LNG,
              radius:    OFFICE_RADIUS,
              distance:  `${Math.round(dist)}m`,
              withinOffice: dist <= OFFICE_RADIUS,
            });

            setLatitude(lat);
            setLongitude(lng);
            setAccuracy(acc);
            setDistance(dist);

            if (dist <= OFFICE_RADIUS) {
              setStatus('success');
              setErrorMsg('');
              resolve({ latitude: lat, longitude: lng });
            } else {
              setStatus('outside');
              setErrorMsg(
                `You are ${Math.round(dist)}m away from the office. ` +
                `You must be within ${OFFICE_RADIUS}m to submit a support log.`
              );
              resolve(null);
            }
          },

          (error) => {
            // ── Debug log for errors too ──────────────────────────────────
            console.log('[useGeolocation] GPS error:', {
              code:    error.code,
              message: error.message,
            });

            switch (error.code) {
              case error.PERMISSION_DENIED:
                setStatus('denied');
                setErrorMsg(
                  'Location permission denied. Please allow location access ' +
                  'in your browser settings to submit support logs.'
                );
                break;
              case error.POSITION_UNAVAILABLE:
                setStatus('unavailable');
                setErrorMsg('Location information is unavailable. Please try again.');
                break;
              case error.TIMEOUT:
                setStatus('timeout');
                setErrorMsg('GPS signal is weak. Move near a window and try again.');
                break;
              default:
                setStatus('error');
                setErrorMsg('An error occurred while getting your location.');
            }
            resolve(null);
          },

          {
            enableHighAccuracy: true,
            timeout:            10000,
            maximumAge:         0,
          }
        );
      });
    },
    []
  );

  return {
    status,
    latitude,
    longitude,
    accuracy,
    distance,
    withinOffice: status === 'success',
    errorMessage: errorMsg,
    requestLocation,
  };
}