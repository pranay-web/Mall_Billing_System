import JsBarcode from 'jsbarcode';
import { useEffect, useRef } from 'react';

/**
 * Crisp, scalable SVG barcode. EAN-13 for products (13 digits), Code 128 for
 * anything alphanumeric such as bill IDs.
 */
export function Barcode({ value, format = /^\d{13}$/.test(value) ? 'EAN13' : 'CODE128', height = 60, barWidth = 2, showText = true, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg || !value) return;
    try {
      JsBarcode(svg, value, {
        format,
        height,
        width: barWidth,
        displayValue: showText,
        margin: 0,
        marginLeft: format === 'EAN13' ? 12 : 0,
        fontSize: 15,
        textMargin: 3,
        font: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        background: 'transparent',
        lineColor: '#18181b',
      });
      // Make the SVG scale with its container instead of using fixed pixel sizes.
      const w = svg.getAttribute('width');
      const h = svg.getAttribute('height');
      if (w && h) {
        svg.setAttribute('viewBox', `0 0 ${parseFloat(w)} ${parseFloat(h)}`);
        svg.removeAttribute('width');
        svg.removeAttribute('height');
      }
    } catch {
      svg.innerHTML = '';
    }
  }, [value, format, height, barWidth, showText]);

  return <svg ref={ref} role="img" aria-label={`Barcode ${value}`} className={`block h-auto w-full ${className}`} />;
}
