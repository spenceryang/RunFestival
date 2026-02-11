import type { GpsPoint } from '@/types/run';

export type GpsCallback = (point: GpsPoint) => void;
export type GpsErrorCallback = (error: GeolocationPositionError) => void;

const GPS_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 10_000,
};

const MAX_ACCURACY_METERS = 30;

export class GpsTracker {
  private watchId: number | null = null;
  private onPoint: GpsCallback;
  private onError: GpsErrorCallback;

  constructor(onPoint: GpsCallback, onError: GpsErrorCallback) {
    this.onPoint = onPoint;
    this.onError = onError;
  }

  start(): boolean {
    if (!('geolocation' in navigator)) {
      return false;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const point: GpsPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          altitude: position.coords.altitude,
          speed: position.coords.speed,
          timestamp: position.timestamp,
          accuracy: position.coords.accuracy,
        };

        // Filter out inaccurate points
        if (point.accuracy <= MAX_ACCURACY_METERS) {
          this.onPoint(point);
        }
      },
      (error) => {
        this.onError(error);
      },
      GPS_OPTIONS
    );

    return true;
  }

  stop(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  get isTracking(): boolean {
    return this.watchId !== null;
  }
}
