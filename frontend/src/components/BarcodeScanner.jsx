import { Camera, CameraOff, Flashlight, FlashlightOff, Keyboard, LockKeyhole, RefreshCw, ScanBarcode, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getBarcodeEngine } from '../lib/barcodeEngine.js';
import { Button } from './ui/Button.jsx';
import { Spinner } from './ui/misc.jsx';

const SCAN_INTERVAL_MS = 90;
const DUPLICATE_WINDOW_MS = 2200;

// Scan window (fractions of the visible viewport) — a wide band shaped like a barcode.
const ROI = { x: 0.07, y: 0.3, w: 0.86, h: 0.4 };

const classify = (err) => {
  const msg = `${err?.name ?? ''} ${err?.message ?? err ?? ''}`;
  if (/NotAllowed|Permission|denied|Security/i.test(msg)) return 'denied';
  if (/NotFound|DevicesNotFound|Overconstrained|NotReadable|TrackStart/i.test(msg)) return 'unavailable';
  return 'error';
};

const FALLBACK_COPY = {
  idle: { icon: ScanBarcode, title: 'Barcode scanner', body: 'Point your camera at the barcode on any product tag. It’s added to your bag instantly.' },
  denied: { icon: CameraOff, title: 'Camera access blocked', body: 'Allow camera access in your browser settings, or type the barcode instead.' },
  unavailable: { icon: CameraOff, title: 'No camera available', body: 'This device has no usable camera. Type the barcode or browse the catalog.' },
  insecure: { icon: LockKeyhole, title: 'Camera needs a secure connection', body: 'Open FlashCart over HTTPS (npm run dev:https) or on localhost to use the camera.' },
  error: { icon: CameraOff, title: "Couldn't start the scanner", body: 'Another app may be using the camera. Try again, or type the barcode.' },
};

/**
 * Camera barcode reader (EAN-13 / UPC / Code 128 …). Decodes a wide band in the
 * middle of the frame ~10× a second, with a periodic full-frame pass for tags held
 * off-centre. Includes torch control and manual / simulated fallbacks.
 */
export function BarcodeScanner({
  onDetected,
  paused = false,
  autoStart = false,
  onManualEntry,
  onSimulate,
  hint = 'Line up the barcode inside the frame',
  className = '',
  compact = false,
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const runRef = useRef(0);
  const lastRef = useRef({ text: '', at: 0 });
  const pausedRef = useRef(paused);
  const onDetectedRef = useRef(onDetected);
  pausedRef.current = paused;
  onDetectedRef.current = onDetected;

  const [state, setState] = useState('idle'); // idle | starting | live | denied | unavailable | insecure | error
  const [engineReady, setEngineReady] = useState(false);
  const [torch, setTorch] = useState({ supported: false, on: false });
  const [mirrored, setMirrored] = useState(false);
  const [lastRead, setLastRead] = useState(null);

  const stop = useCallback(() => {
    runRef.current += 1;
    clearTimeout(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setTorch({ supported: false, on: false });
    setEngineReady(false);
  }, []);

  /** Decode loop: crop the scan band (matching what the user sees), then ask the detector. */
  const runLoop = useCallback((run, detector) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let tick = 0;

    const step = async () => {
      if (run !== runRef.current) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && !pausedRef.current && !document.hidden) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const box = video.getBoundingClientRect();
        // The <video> uses object-fit: cover — work out which part of the frame is visible.
        const scale = Math.max(box.width / vw, box.height / vh) || 1;
        const visW = Math.min(vw, box.width / scale);
        const visH = Math.min(vh, box.height / scale);
        const fullFrame = tick++ % 4 === 3;
        const sx = fullFrame ? 0 : (vw - visW) / 2 + visW * ROI.x;
        const sy = fullFrame ? 0 : (vh - visH) / 2 + visH * ROI.y;
        const sw = fullFrame ? vw : visW * ROI.w;
        const sh = fullFrame ? vh : visH * ROI.h;
        const down = Math.min(1, 1280 / sw);
        canvas.width = Math.max(1, Math.round(sw * down));
        canvas.height = Math.max(1, Math.round(sh * down));
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        try {
          const codes = await detector.detect(canvas);
          const hit = codes.find((c) => c.rawValue?.trim());
          if (hit && run === runRef.current) {
            const text = hit.rawValue.trim();
            const now = Date.now();
            if (text !== lastRef.current.text || now - lastRef.current.at > DUPLICATE_WINDOW_MS) {
              lastRef.current = { text, at: now };
              setLastRead({ text, key: now });
              onDetectedRef.current?.(text, hit.format);
            }
          }
        } catch {
          /* a frame that can't be decoded — keep going */
        }
      }
      if (run === runRef.current) timerRef.current = setTimeout(step, SCAN_INTERVAL_MS);
    };
    step();
  }, []);

  const start = useCallback(async () => {
    if (!window.isSecureContext) return setState('insecure');
    if (!navigator.mediaDevices?.getUserMedia) return setState('unavailable');
    stop();
    const run = runRef.current;
    setState('starting');
    const enginePromise = getBarcodeEngine(); // load the decoder while the camera warms up

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
    } catch (err) {
      if (run === runRef.current) setState(classify(err));
      return;
    }
    if (run !== runRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;

    const [track] = stream.getVideoTracks();
    try {
      await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
    } catch {
      /* not supported — fine */
    }
    const settings = track.getSettings?.() ?? {};
    const caps = track.getCapabilities?.() ?? {};
    // Front / laptop cameras feel natural mirrored; rear phone cameras don't.
    setMirrored(settings.facingMode === 'user' || (!settings.facingMode && !/Android|iPhone|iPad/i.test(navigator.userAgent)));
    setTorch({ supported: Boolean(caps.torch), on: false });

    const video = videoRef.current;
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      /* autoplay is muted + inline; ignore */
    }
    setState('live');

    try {
      const { detector } = await enginePromise;
      if (run !== runRef.current) return;
      setEngineReady(true);
      runLoop(run, detector);
    } catch {
      if (run === runRef.current) {
        stop();
        setState('error');
      }
    }
  }, [runLoop, stop]);

  const toggleTorch = async () => {
    const [track] = streamRef.current?.getVideoTracks() ?? [];
    if (!track) return;
    const next = !torch.on;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorch((t) => ({ ...t, on: next }));
    } catch {
      setTorch({ supported: false, on: false });
    }
  };

  useEffect(() => {
    if (autoStart) start();
    return stop;
  }, [autoStart, start, stop]);

  // Clear the "read" pill shortly after each scan.
  useEffect(() => {
    if (!lastRead) return undefined;
    const t = setTimeout(() => setLastRead(null), 1600);
    return () => clearTimeout(t);
  }, [lastRead]);

  const live = state === 'live';
  const fallback = FALLBACK_COPY[state];

  return (
    <div
      className={`relative isolate overflow-hidden rounded-[28px] bg-zinc-950 shadow-lift ring-1 ring-black/10 ${compact ? 'aspect-[4/3]' : 'aspect-[4/5] sm:aspect-[16/10]'} ${className}`}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${live ? 'opacity-100' : 'opacity-0'}`}
        style={mirrored ? { transform: 'scaleX(-1)' } : undefined}
      />

      {/* Ambient backdrop when the camera is off. */}
      {!live && (
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,#1e3a8a_0%,#0b1020_45%,#09090b_100%)]" aria-hidden>
          <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:28px_28px]" />
        </div>
      )}

      {/* Dim everything outside the scan band. */}
      {live && (
        <div
          className="pointer-events-none absolute rounded-2xl shadow-[0_0_0_100vmax_rgb(0_0_0/0.45)]"
          style={{ left: `${ROI.x * 100}%`, top: `${ROI.y * 100}%`, width: `${ROI.w * 100}%`, height: `${ROI.h * 100}%` }}
          aria-hidden
        />
      )}

      {/* Barcode-shaped reticle + laser */}
      <div
        className={`pointer-events-none absolute transition-opacity duration-500 ${live || state === 'idle' || state === 'starting' ? 'opacity-100' : 'opacity-30'}`}
        style={{ left: `${ROI.x * 100}%`, top: `${ROI.y * 100}%`, width: `${ROI.w * 100}%`, height: `${ROI.h * 100}%` }}
        aria-hidden
      >
        <span className="absolute left-0 top-0 size-8 rounded-tl-2xl border-l-[3px] border-t-[3px] border-white" />
        <span className="absolute right-0 top-0 size-8 rounded-tr-2xl border-r-[3px] border-t-[3px] border-white" />
        <span className="absolute bottom-0 left-0 size-8 rounded-bl-2xl border-b-[3px] border-l-[3px] border-white" />
        <span className="absolute bottom-0 right-0 size-8 rounded-br-2xl border-b-[3px] border-r-[3px] border-white" />
        {(live ? engineReady : true) && (
          <span className="absolute inset-x-4 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_14px_3px_rgb(239_68_68/0.55)] animate-pulse" />
        )}
      </div>

      {/* Detection flash + decoded value */}
      {lastRead && (
        <>
          <div key={lastRead.key} className="pointer-events-none absolute inset-0 bg-white animate-flash" aria-hidden />
          <div className="pointer-events-none absolute inset-x-0 flex justify-center" style={{ top: `calc(${(ROI.y + ROI.h) * 100}% + 12px)` }}>
            <span className="rounded-full bg-emerald-500 px-3 py-1 font-mono text-[12px] font-semibold tracking-wider text-white shadow-lg animate-pop">
              {lastRead.text}
            </span>
          </div>
        </>
      )}

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3.5">
        <span className="inline-flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/90 backdrop-blur-md">
          {live && engineReady ? (
            <>
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
              </span>
              Reading barcodes
            </>
          ) : state === 'starting' || live ? (
            <>
              <Spinner className="size-3" /> {live ? 'Loading reader' : 'Starting'}
            </>
          ) : (
            <>
              <ScanBarcode className="size-3.5" /> Barcode scanner
            </>
          )}
        </span>
        <div className="flex items-center gap-2">
          {live && torch.supported && (
            <button
              onClick={toggleTorch}
              aria-pressed={torch.on}
              aria-label={torch.on ? 'Turn flashlight off' : 'Turn flashlight on'}
              className={`grid size-10 place-items-center rounded-full backdrop-blur-md transition ${torch.on ? 'bg-amber-300 text-zinc-900' : 'bg-black/40 text-white hover:bg-black/55'}`}
            >
              {torch.on ? <Flashlight className="size-[18px]" /> : <FlashlightOff className="size-[18px]" />}
            </button>
          )}
          {live && (
            <button
              onClick={() => {
                stop();
                setState('idle');
              }}
              className="rounded-full bg-black/40 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-black/55"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Fallback / CTA panel */}
      {!live && state !== 'starting' && fallback && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-white/10 text-white ring-1 ring-white/15 backdrop-blur-md">
            <fallback.icon className="size-6" strokeWidth={1.8} />
          </div>
          <p className="text-base font-semibold text-white">{fallback.title}</p>
          <p className="mt-1.5 max-w-[19rem] text-[13px] leading-relaxed text-white/60">{fallback.body}</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {(state === 'idle' || state === 'error' || state === 'denied') && (
              <Button onClick={start} icon={state === 'idle' ? Camera : RefreshCw}>
                {state === 'idle' ? 'Start camera' : 'Try again'}
              </Button>
            )}
            {onManualEntry && (
              <Button variant="glass" icon={Keyboard} onClick={onManualEntry}>
                Type barcode
              </Button>
            )}
          </div>
          {onSimulate && (
            <button
              onClick={onSimulate}
              className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-white/50 underline-offset-4 transition hover:text-white hover:underline"
            >
              <Sparkles className="size-3.5" /> Simulate a scan (demo)
            </button>
          )}
        </div>
      )}

      {state === 'starting' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-sm font-medium text-white backdrop-blur-md">
            <Spinner className="size-4" /> Opening camera…
          </div>
        </div>
      )}

      {/* Bottom hint */}
      {live && (
        <div className="absolute inset-x-0 bottom-0 flex justify-center p-4">
          <span className="rounded-full bg-black/50 px-3.5 py-1.5 text-[12px] font-medium text-white/90 backdrop-blur-md">
            {!engineReady ? 'Preparing barcode reader…' : paused ? 'Adding to bag…' : hint}
          </span>
        </div>
      )}
    </div>
  );
}
