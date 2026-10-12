import zxingWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

/** 1D retail / logistics barcodes only — product tags and printed bills. No QR. */
export const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'];

let enginePromise = null;

/**
 * Resolves a BarcodeDetector restricted to linear barcodes.
 * Uses the browser's native detector when it handles EAN-13 (Chrome on Android/macOS),
 * otherwise ZXing-C++ compiled to WebAssembly (Safari, Firefox) — served from our own
 * origin so scanning also works offline / on the mall LAN.
 */
export const getBarcodeEngine = () => {
  enginePromise ??= (async () => {
    if ('BarcodeDetector' in window) {
      try {
        const supported = await window.BarcodeDetector.getSupportedFormats();
        if (supported.includes('ean_13')) {
          const formats = BARCODE_FORMATS.filter((f) => supported.includes(f));
          return { kind: 'native', detector: new window.BarcodeDetector({ formats }) };
        }
      } catch {
        /* fall through to the WebAssembly engine */
      }
    }
    const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill');
    await prepareZXingModule({
      overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? zxingWasmUrl : prefix + path) },
      fireImmediately: true,
    });
    return { kind: 'zxing', detector: new BarcodeDetector({ formats: BARCODE_FORMATS }) };
  })().catch((err) => {
    enginePromise = null;
    throw err;
  });
  return enginePromise;
};
