"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onError?: (message: string) => void;
}

export function BarcodeScanner({ onDetected, onError }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const scanningRef = useRef(false);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    scanningRef.current = false;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    readerRef.current = null;
    const video = videoRef.current;
    const stream = video?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (video) video.srcObject = null;
    setActive(false);
    setStarting(false);
  }, []);

  const handleCode = useCallback(
    (code: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        stop();
        onDetected(code);
      }, 300);
    },
    [onDetected, stop]
  );

  const startNativeDetector = useCallback(
    async (video: HTMLVideoElement) => {
      type Detector = {
        detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
      };
      const BarcodeDetectorCtor = (
        window as Window & {
          BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
        }
      ).BarcodeDetector;

      if (!BarcodeDetectorCtor) return false;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      video.srcObject = stream;
      await video.play();

      const detector = new BarcodeDetectorCtor({
        formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e"],
      });

      scanningRef.current = true;
      setActive(true);

      const loop = async () => {
        if (!scanningRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const code = codes[0]?.rawValue;
          if (code) {
            handleCode(code);
            return;
          }
        } catch {
          // keep scanning
        }
        requestAnimationFrame(() => void loop());
      };

      void loop();
      return true;
    },
    [handleCode]
  );

  const start = useCallback(async () => {
    if (starting || active) return;
    setStarting(true);

    try {
      const video = videoRef.current;
      if (!video) throw new Error("Video element not ready");

      const usedNative = await startNativeDetector(video);
      if (usedNative) return;

      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      scanningRef.current = true;
      setActive(true);

      await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        video,
        (result) => {
          const code = result?.getText();
          if (code) handleCode(code);
        }
      );
    } catch {
      stop();
      onError?.("Camera not available — use manual entry");
    } finally {
      setStarting(false);
    }
  }, [active, handleCode, onError, startNativeDetector, starting, stop]);

  useEffect(() => () => stop(), [stop]);

  return (
    <div>
      <div className="relative rounded-[var(--radius)] overflow-hidden bg-black aspect-[4/3] mb-3">
        <video
          ref={videoRef}
          className="w-full h-full object-cover block"
          autoPlay
          playsInline
          muted
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="scanner-box w-[70%] max-w-[220px] aspect-[3/1] border-2 border-white rounded-md relative" />
        </div>
      </div>
      <div className="flex gap-2.5 mb-3">
        {!active ? (
          <button
            type="button"
            onClick={start}
            disabled={starting}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-[var(--radius)] border border-accent bg-accent text-white py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {starting ? "Starting…" : "Start camera"}
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-[var(--radius)] border border-border2 bg-surface py-2.5 text-sm font-medium"
          >
            Stop
          </button>
        )}
      </div>
    </div>
  );
}
