// frontend/src/components/Scanner.jsx
import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { AlertCircle, Camera, Check } from 'lucide-react';

export default function Scanner({ sessionId, onProductScanned }) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [lastScanned, setLastScanned] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!scanning) return;

    const scanner = new Html5QrcodeScanner(
      'scanner',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        rememberLastUsedCamera: true,
        showTorchButtonIfSupported: true,
      },
      false
    );

    scanner.render(
      (decodedText) => {
        setLastScanned(decodedText);
        onProductScanned(decodedText);
        setTimeout(() => setLastScanned(''), 2000);
      },
      (err) => {
        // Non-fatal scanning ticks
      }
    );

    return () => {
      scanner.clear().catch((err) => console.error('Error clearing scanner:', err));
    };
  }, [scanning, onProductScanned]);

  const handleManualScan = async () => {
    if (!manualBarcode.trim()) return;
    setLastScanned(manualBarcode);
    onProductScanned(manualBarcode);
    setManualBarcode('');
    setTimeout(() => setLastScanned(''), 2000);
  };

  return (
    <div className="max-w-xl mx-auto py-4 space-y-6">
      {!scanning ? (
        <div className="bg-white border border-[#e2e8f0] rounded-md p-8 text-center space-y-6 shadow-xs">
          <div className="w-12 h-12 rounded-lg bg-[#eff6ff] border border-[#dbeafe] flex items-center justify-center mx-auto text-[#0066ff]">
            <Camera className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-bold text-[#0f172a] tracking-tight">Camera Barcode Scanner</h3>
            <p className="text-xs text-[#475569] max-w-sm mx-auto leading-relaxed">
              Scan product tags across clothing, electronics, food, and jewelry showrooms.
            </p>
          </div>

          <div>
            <button
              onClick={() => setScanning(true)}
              className="w-full bg-[#0066ff] hover:bg-[#0052cc] text-white font-bold py-3.5 px-6 rounded-md text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              <Camera className="w-4 h-4" />
              <span>Activate Camera</span>
            </button>
          </div>

          {/* Manual Barcode Entry */}
          <div className="pt-4 border-t border-[#e2e8f0] text-left space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#475569] block">
              Enter Barcode Number
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. SHIRT001, JEANS001, PIZZA001"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleManualScan()}
                className="flex-1 px-3.5 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] focus:border-[#0066ff] rounded-md text-[#0f172a] placeholder-[#94a3b8] text-xs font-mono focus:outline-none"
              />
              <button
                onClick={handleManualScan}
                className="bg-[#0066ff] hover:bg-[#0052cc] text-white px-5 py-2.5 rounded-md font-bold transition cursor-pointer text-xs flex items-center gap-1 shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#e2e8f0] rounded-md p-6 space-y-4 shadow-xs">
          <div className="flex justify-between items-center pb-2 border-b border-[#e2e8f0]">
            <span className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">Scanner Viewport</span>
            <button
              onClick={() => setScanning(false)}
              className="text-xs font-bold text-[#ef4444] hover:underline cursor-pointer"
            >
              Cancel Camera
            </button>
          </div>

          {/* Scanner Container */}
          <div id="scanner" className="rounded-md overflow-hidden border border-[#0066ff] bg-[#f8fafc]"></div>

          {lastScanned && (
            <div className="bg-[#ecfdf5] border border-[#a7f3d0] rounded-md p-2.5 text-center text-emerald-700 font-mono text-xs font-bold">
              ✓ Scanned Barcode: {lastScanned}
            </div>
          )}

          {error && (
            <div className="bg-[#fef2f2] border border-[#fecaca] rounded-md p-2.5 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <input
              type="text"
              placeholder="Manual barcode..."
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === 'Enter' && handleManualScan()}
              className="flex-1 px-3 py-2 bg-[#f8fafc] border border-[#e2e8f0] rounded-md text-[#0f172a] font-mono text-xs focus:outline-none"
            />
            <button
              onClick={handleManualScan}
              className="bg-[#0066ff] text-white px-4 py-2 rounded-md text-xs font-bold"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
