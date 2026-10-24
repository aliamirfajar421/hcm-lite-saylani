"use client";

import { useEffect, useRef, useState } from "react";
import ModalDialog from "./ModalDialog";
import { checkInApi, enrollFaceApi } from "@/api/hcm";
import { getApiErrorMessage } from "@/lib/api";

interface CameraCheckInModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onFallbackCorrection?: () => void;
  hasEnrolledFace?: boolean;
}

/**
 * Extracts a normalized 16-bin center-face luminance/tone descriptor + motion score
 * and uses native FaceDetector API when available in Chromium browsers.
 */
async function analyzeVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  prevDescriptor: number[] | null
): Promise<{
  faceDetected: boolean;
  faceCount: number;
  descriptor: number[];
  motionDelta: number;
}> {
  const w = 160;
  const h = 120;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || video.readyState < 2) {
    return { faceDetected: false, faceCount: 0, descriptor: [], motionDelta: 0 };
  }

  ctx.drawImage(video, 0, 0, w, h);

  // 1. Use browser native FaceDetector API if supported
  let nativeFaceCount: number | null = null;
  if (typeof window !== "undefined" && "FaceDetector" in window) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detector = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 3 });
      const faces = await detector.detect(canvas);
      nativeFaceCount = Array.isArray(faces) ? faces.length : null;
    } catch {
      nativeFaceCount = null;
    }
  }

  // 2. Compute 4x4 central facial grid descriptor & skin/contrast presence heuristic
  const img = ctx.getImageData(40, 15, 80, 90);
  const data = img.data;
  const bins = new Array(16).fill(0);
  const counts = new Array(16).fill(0);
  let skinLikePixels = 0;
  const totalPixels = 80 * 90;

  for (let y = 0; y < 90; y++) {
    for (let x = 0; x < 80; x++) {
      const idx = (y * 80 + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Broad inclusive skin/face illumination check across diverse skin tones
      if (r > 45 && g > 30 && b > 20 && r > b && Math.abs(r - g) < 95) {
        skinLikePixels++;
      }

      const bx = Math.min(3, Math.floor((x / 80) * 4));
      const by = Math.min(3, Math.floor((y / 90) * 4));
      const binIdx = by * 4 + bx;
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      bins[binIdx] += lum;
      counts[binIdx] += 1;
    }
  }

  const rawDesc = bins.map((sum, i) => (counts[i] ? sum / counts[i] : 0));
  const mean = rawDesc.reduce((a, b) => a + b, 0) / rawDesc.length;
  const std =
    Math.sqrt(rawDesc.reduce((a, b) => a + (b - mean) ** 2, 0) / rawDesc.length) || 1;
  const descriptor = rawDesc.map((v) => Math.round(((v - mean) / std) * 1000) / 1000);

  let motionDelta = 0;
  if (prevDescriptor && prevDescriptor.length === descriptor.length) {
    motionDelta =
      descriptor.reduce((acc, v, i) => acc + Math.abs(v - prevDescriptor[i]), 0) /
      descriptor.length;
  }

  const heuristicDetected = skinLikePixels / totalPixels > 0.18 && std > 0.04;
  const faceCount =
    nativeFaceCount !== null ? nativeFaceCount : heuristicDetected ? 1 : 0;

  return {
    faceDetected: faceCount === 1,
    faceCount,
    descriptor,
    motionDelta,
  };
}

export default function CameraCheckInModal({
  open,
  onClose,
  onSuccess,
  onFallbackCorrection,
  hasEnrolledFace = false,
}: CameraCheckInModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevDescRef = useRef<number[] | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [faceCount, setFaceCount] = useState(0);
  const [livenessVerified, setLivenessVerified] = useState(false);
  const [descriptor, setDescriptor] = useState<number[]>([]);
  const [gps, setGps] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
  } | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  // Start camera + GPS when modal opens
  useEffect(() => {
    if (!open) return;

    let stream: MediaStream | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    setErrorMsg("");
    setInfoMsg("");
    setGpsError("");
    setLivenessVerified(false);

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user", width: 480, height: 360 }, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          setCameraReady(true);
        }

        intervalId = setInterval(async () => {
          if (!videoRef.current || !canvasRef.current) return;
          const res = await analyzeVideoFrame(
            videoRef.current,
            canvasRef.current,
            prevDescRef.current
          );
          prevDescRef.current = res.descriptor;
          setFaceCount(res.faceCount);
          if (res.descriptor.length > 0) setDescriptor(res.descriptor);
          if (res.faceDetected && res.motionDelta > 0.025) {
            setLivenessVerified(true);
          }
        }, 550);
      })
      .catch(() => {
        setErrorMsg("Camera permission denied or no webcam available.");
      });

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGps({
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
            accuracy: Math.round(pos.coords.accuracy),
          });
        },
        () => {
          setGpsError("Location permission denied or unavailable.");
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    } else {
      setGpsError("Geolocation is not supported by this browser.");
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      setCameraReady(false);
    };
  }, [open]);

  const handleEnrollFace = async () => {
    if (faceCount !== 1 || descriptor.length < 8) {
      setErrorMsg("Center your face in the frame before enrolling.");
      return;
    }
    setEnrolling(true);
    setErrorMsg("");
    try {
      const res = await enrollFaceApi(descriptor);
      setInfoMsg(res.message);
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err));
    } finally {
      setEnrolling(false);
    }
  };

  const handleCameraCheckIn = async () => {
    setErrorMsg("");
    setSubmitting(true);
    try {
      const res = await checkInApi({
        source: "camera",
        lat: gps?.lat,
        lng: gps?.lng,
        accuracy: gps?.accuracy,
        faceDetected: faceCount === 1,
        faceCount,
        livenessVerified,
        faceDescriptor: descriptor,
      });
      onSuccess(res.message);
      onClose();
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err, "Camera check-in rejected by server"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Camera + Geofence Check-In"
      subtitle="Live face detection + browser GPS verified on the server (Haversine formula)"
    >
      <div className="space-y-4">
        {/* Live Front Camera Frame */}
        <div className="relative overflow-hidden rounded-xl border border-[var(--border-color)] bg-slate-950 aspect-[4/3]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover scale-x-[-1]"
          />
          <canvas ref={canvasRef} className="hidden" />
          {/* Face Framing Guide */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className={`h-44 w-36 rounded-3xl border-2 transition-colors ${
                faceCount === 1
                  ? "border-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.35)]"
                  : "border-amber-400/80 border-dashed"
              }`}
            />
          </div>
          <div className="absolute bottom-2.5 left-2.5 right-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950/75 px-3 py-1.5 text-xs text-white">
            <span>
              {!cameraReady
                ? "Starting front camera..."
                : faceCount === 1
                ? "✓ 1 Face Detected"
                : faceCount > 1
                ? `⚠ ${faceCount} Faces (Only 1 allowed)`
                : "Center your face in frame"}
            </span>
            <span>
              {livenessVerified ? "✓ Liveness (Blink/Motion)" : "Blink / nod slightly"}
            </span>
          </div>
        </div>

        {/* GPS Status */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
          <div className="surface-subtle rounded-lg p-3">
            <p className="font-semibold text-muted">GPS Coordinates</p>
            {gps ? (
              <p className="mt-1 font-mono">
                {gps.lat}, {gps.lng}
              </p>
            ) : (
              <p className="mt-1 text-amber-600 dark:text-amber-400">
                {gpsError || "Acquiring GPS fix..."}
              </p>
            )}
          </div>
          <div className="surface-subtle rounded-lg p-3">
            <p className="font-semibold text-muted">GPS Accuracy (Max 100 m)</p>
            {gps ? (
              <p
                className={`mt-1 font-semibold ${
                  gps.accuracy <= 100
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                ±{gps.accuracy} m {gps.accuracy <= 100 ? "(Pass)" : "(Too weak > 100m)"}
              </p>
            ) : (
              <p className="mt-1 text-muted">Waiting for GPS...</p>
            )}
          </div>
        </div>

        {/* Privacy Notice required by Section 5 */}
        <div className="rounded-lg border border-teal-500/30 bg-teal-500/10 p-3 text-xs">
          <strong>What is captured:</strong> Only face verification status, optional numeric face
          descriptor match, liveness flag, and server-verified office distance are stored —{" "}
          <strong>no full photo is saved</strong>.
        </div>

        {infoMsg && (
          <div className="rounded-lg bg-emerald-500/15 p-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            {infoMsg}
          </div>
        )}

        {errorMsg && (
          <div className="space-y-2 rounded-lg bg-rose-500/15 p-3 text-xs text-rose-700 dark:text-rose-300">
            <p className="font-semibold">{errorMsg}</p>
            {onFallbackCorrection && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onFallbackCorrection();
                }}
                className="underline font-semibold"
              >
                Fallback → Submit an HR Attendance Correction Request
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            disabled={enrolling || faceCount !== 1}
            onClick={handleEnrollFace}
            className="btn-secondary text-xs"
          >
            {enrolling
              ? "Enrolling..."
              : hasEnrolledFace
              ? "Update Enrolled Face"
              : "Enroll Face Descriptor (Bonus)"}
          </button>

          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || faceCount !== 1 || !gps}
              onClick={handleCameraCheckIn}
              className="btn-primary"
            >
              {submitting ? "Verifying on Server..." : "Verify & Check In"}
            </button>
          </div>
        </div>
      </div>
    </ModalDialog>
  );
}

