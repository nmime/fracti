import { useState, useEffect, useCallback, useRef } from 'react'
import WebApp from '@twa-dev/sdk'
import { useTelegram } from '@/lib/telegram'

interface OrientationData {
  alpha: number // Z-axis rotation (0-360)
  beta: number  // X-axis rotation (-180 to 180)
  gamma: number // Y-axis rotation (-90 to 90)
}

interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
}

const SHAKE_THRESHOLD = 25

export function DeviceSensors() {
  const { isTelegram, hapticFeedback } = useTelegram()
  const [orientation, setOrientation] = useState<OrientationData>({ alpha: 0, beta: 0, gamma: 0 })
  const [location, setLocation] = useState<LocationData | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [shakeDetected, setShakeDetected] = useState(false)
  const [gyroscopeEnabled, setGyroscopeEnabled] = useState(false)
  const lastAcceleration = useRef({ x: 0, y: 0, z: 0 })
  const watchId = useRef<number | null>(null)

  // Start gyroscope
  const startGyroscope = useCallback(() => {
    if (isTelegram && WebApp.Gyroscope) {
      WebApp.Gyroscope.start({ refresh_rate: 100 })
      setGyroscopeEnabled(true)
    } else {
      // Fallback to DeviceOrientation API
      setGyroscopeEnabled(true)
    }
  }, [isTelegram])

  // Stop gyroscope
  const stopGyroscope = useCallback(() => {
    if (isTelegram && WebApp.Gyroscope) {
      WebApp.Gyroscope.stop()
    }
    setGyroscopeEnabled(false)
  }, [isTelegram])

  // Handle device orientation
  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      setOrientation({
        alpha: event.alpha || 0,
        beta: event.beta || 0,
        gamma: event.gamma || 0,
      })
    }

    if (gyroscopeEnabled) {
      window.addEventListener('deviceorientation', handleOrientation)
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation)
    }
  }, [gyroscopeEnabled])

  // Handle device motion for shake detection
  useEffect(() => {
    const handleMotion = (event: DeviceMotionEvent) => {
      const acceleration = event.accelerationIncludingGravity
      if (!acceleration) return

      const { x = 0, y = 0, z = 0 } = acceleration
      const last = lastAcceleration.current

      const deltaX = Math.abs(x - last.x)
      const deltaY = Math.abs(y - last.y)
      const deltaZ = Math.abs(z - last.z)

      if (deltaX + deltaY + deltaZ > SHAKE_THRESHOLD) {
        setShakeDetected(true)
        hapticFeedback.impactOccurred('heavy')
        setTimeout(() => setShakeDetected(false), 500)
      }

      lastAcceleration.current = { x, y, z }
    }

    if (gyroscopeEnabled) {
      window.addEventListener('devicemotion', handleMotion)
    }

    return () => {
      window.removeEventListener('devicemotion', handleMotion)
    }
  }, [gyroscopeEnabled, hapticFeedback])

  // Start location tracking
  const startLocationTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported')
      return
    }

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
        setLocationError(null)
      },
      (error) => {
        setLocationError(error.message)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }, [])

  // Stop location tracking
  const stopLocationTracking = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
    setLocation(null)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current)
      }
      if (gyroscopeEnabled && isTelegram && WebApp.Gyroscope) {
        WebApp.Gyroscope.stop()
      }
    }
  }, [gyroscopeEnabled, isTelegram])

  // Haptic feedback handlers
  const triggerImpact = (style: 'light' | 'medium' | 'heavy' | 'soft' | 'rigid') => {
    hapticFeedback.impactOccurred(style)
  }

  const triggerNotification = (type: 'success' | 'warning' | 'error') => {
    hapticFeedback.notificationOccurred(type)
  }

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-xl font-bold">Device Sensors</h2>

      {/* Gyroscope Section */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Gyroscope</h3>
          <button
            onClick={gyroscopeEnabled ? stopGyroscope : startGyroscope}
            className={`px-3 py-1 rounded-md text-sm font-medium ${
              gyroscopeEnabled
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {gyroscopeEnabled ? 'Stop' : 'Start'}
          </button>
        </div>

        {gyroscopeEnabled && (
          <>
            <div className="grid grid-cols-3 gap-2 text-center mb-4">
              <div className="bg-muted rounded p-2">
                <p className="text-xs text-muted-foreground">Alpha (Z)</p>
                <p className="font-mono">{orientation.alpha.toFixed(1)}°</p>
              </div>
              <div className="bg-muted rounded p-2">
                <p className="text-xs text-muted-foreground">Beta (X)</p>
                <p className="font-mono">{orientation.beta.toFixed(1)}°</p>
              </div>
              <div className="bg-muted rounded p-2">
                <p className="text-xs text-muted-foreground">Gamma (Y)</p>
                <p className="font-mono">{orientation.gamma.toFixed(1)}°</p>
              </div>
            </div>

            {/* 3D Cube Visualization */}
            <div className="flex justify-center">
              <div
                className="w-20 h-20 relative"
                style={{
                  perspective: '200px',
                  transformStyle: 'preserve-3d',
                }}
              >
                <div
                  className="w-full h-full bg-gradient-to-br from-primary to-primary/50 rounded-lg border-2 border-primary/30"
                  style={{
                    transform: `rotateX(${orientation.beta}deg) rotateY(${orientation.gamma}deg) rotateZ(${orientation.alpha}deg)`,
                    transition: 'transform 0.1s ease-out',
                  }}
                />
              </div>
            </div>

            {shakeDetected && (
              <div className="mt-4 text-center">
                <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium animate-pulse">
                  Shake Detected!
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* GPS Section */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">GPS Location</h3>
          <button
            onClick={location ? stopLocationTracking : startLocationTracking}
            className={`px-3 py-1 rounded-md text-sm font-medium ${
              location
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {location ? 'Stop' : 'Start'}
          </button>
        </div>

        {locationError && (
          <p className="text-sm text-red-600 mb-2">{locationError}</p>
        )}

        {location && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted rounded p-2">
              <p className="text-xs text-muted-foreground">Latitude</p>
              <p className="font-mono text-sm">{location.latitude.toFixed(6)}</p>
            </div>
            <div className="bg-muted rounded p-2">
              <p className="text-xs text-muted-foreground">Longitude</p>
              <p className="font-mono text-sm">{location.longitude.toFixed(6)}</p>
            </div>
            <div className="bg-muted rounded p-2">
              <p className="text-xs text-muted-foreground">Accuracy</p>
              <p className="font-mono text-sm">{location.accuracy.toFixed(0)}m</p>
            </div>
          </div>
        )}
      </div>

      {/* Haptic Feedback Section */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="font-semibold mb-4">Haptic Feedback</h3>

        <div className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Impact</p>
            <div className="flex flex-wrap gap-2">
              {(['light', 'medium', 'heavy', 'soft', 'rigid'] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => triggerImpact(style)}
                  className="px-3 py-1 bg-primary/10 text-primary rounded-md text-sm hover:bg-primary/20"
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-2">Notification</p>
            <div className="flex flex-wrap gap-2">
              {(['success', 'warning', 'error'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => triggerNotification(type)}
                  className={`px-3 py-1 rounded-md text-sm ${
                    type === 'success'
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : type === 'warning'
                      ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                      : 'bg-red-100 text-red-700 hover:bg-red-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
