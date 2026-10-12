import { useCallback, useRef, useState } from 'react';
import { useToast } from '../../components/ui/Toast.jsx';
import { useShop } from '../../context/ShopContext.jsx';
import { scanFeedback } from '../../lib/feedback.js';
import { formatINR } from '../../lib/format.js';

const ERROR_TITLES = {
  PRODUCT_NOT_FOUND: 'Invalid barcode',
  INVALID_BARCODE: 'Invalid barcode',
  OUT_OF_STOCK: 'Out of stock',
  QUANTITY_LIMIT: 'Quantity limit reached',
  NETWORK: 'Connection problem',
  TIMEOUT: 'Connection problem',
};

/**
 * Shared "code → bag" pipeline for the camera, manual entry and catalog:
 * guards against double submits, gives audio/haptic feedback and offers Undo.
 */
export function useScanToBag() {
  const { addByBarcode, setQuantity, removeItem } = useShop();
  const toast = useToast();
  const [busyCode, setBusyCode] = useState(null);
  const busyRef = useRef(false);

  const undo = useCallback(
    async ({ item, added }) => {
      try {
        if (item.quantity - added <= 0) await removeItem(item.itemId);
        else await setQuantity(item.itemId, item.quantity - added);
        toast({ tone: 'info', title: `Removed ${item.name}` });
      } catch (err) {
        toast({ tone: 'error', title: "Couldn't undo", description: err.message });
      }
    },
    [removeItem, setQuantity, toast],
  );

  const submit = useCallback(
    async (rawCode, { quiet = false } = {}) => {
      const code = String(rawCode ?? '').trim();
      if (!code || busyRef.current) return null;

      if (/^TX-[A-Z0-9]{8}$/i.test(code) || code.startsWith('FLASHCART:')) {
        scanFeedback('error');
        toast({ tone: 'warning', title: "That's a bill barcode", description: 'Show it to the cashier at the cash desk — it can’t be added to a bag.' });
        return null;
      }

      busyRef.current = true;
      setBusyCode(code);
      try {
        const res = await addByBarcode(code);
        scanFeedback('success');
        if (!quiet) {
          const { item } = res;
          toast({
            tone: 'success',
            title: item.quantity > 1 ? `${item.name} · ×${item.quantity}` : `Added ${item.name}`,
            description: `${item.showroom} · ${formatINR(item.unitMrp)} incl. ${item.gstRate}% GST`,
            action: { label: 'Undo', onClick: () => undo(res) },
          });
        }
        return res;
      } catch (err) {
        scanFeedback('error');
        toast({
          tone: err.code === 'OUT_OF_STOCK' || err.code === 'QUANTITY_LIMIT' ? 'warning' : 'error',
          title: ERROR_TITLES[err.code] ?? "Couldn't add item",
          description: err.message,
        });
        return null;
      } finally {
        // Brief cool-down so a lingering barcode in frame isn't re-read instantly.
        setTimeout(() => {
          busyRef.current = false;
          setBusyCode(null);
        }, 450);
      }
    },
    [addByBarcode, toast, undo],
  );

  return { submit, busyCode, busy: busyCode !== null };
}
