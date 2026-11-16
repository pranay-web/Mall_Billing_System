import { CheckCircle2, PackagePlus, ScanBarcode } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { BarcodeScanner } from '../../components/BarcodeScanner.jsx';
import { Field } from '../../components/AuthLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Sheet } from '../../components/ui/Sheet.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { api, ApiError } from '../../lib/api.js';
import { formatINR } from '../../lib/format.js';
import { scanFeedback } from '../../lib/feedback.js';

const GST_RATES = [0, 3, 5, 12, 18, 28];
const EMPTY = { name: '', description: '', mrp: '', gstRate: 18, category: 'clothing', showroomId: '', stock: '', hsn: '' };

/**
 * Staff-only: scan or type any barcode. If it is already in the catalog we say so; if not,
 * the cashier fills in the product and it can be scanned into a bag straight away.
 */
export function AddProduct({ open, onClose, onAdded }) {
  const toast = useToast();
  const [barcode, setBarcode] = useState('');
  const [stage, setStage] = useState('scan'); // scan | existing | form
  const [existing, setExisting] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [catalog, setCatalog] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setBarcode('');
    setStage('scan');
    setExisting(null);
    setForm(EMPTY);
    setError(null);
    setScanning(false);
    api.products().then(setCatalog).catch(() => {});
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  // Categories and showrooms come from the server, so the form always matches the catalog.
  const showroomsFor = (category) => (catalog?.showrooms ?? []).filter((s) => s.category === category);

  const lookup = async (raw) => {
    const code = String(raw ?? barcode).trim();
    if (!code) return;
    setError(null);
    setBarcode(code);
    setScanning(false);
    try {
      const product = await api.product(code);
      scanFeedback('success');
      setExisting(product);
      setStage('existing');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PRODUCT_NOT_FOUND') {
        scanFeedback('success');
        const rows = showroomsFor(EMPTY.category);
        setForm({ ...EMPTY, showroomId: rows[0]?.id ?? '' });
        setStage('form');
      } else {
        setError(err.message);
      }
    }
  };

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const setCategory = (e) => {
    const category = e.target.value;
    setForm((f) => ({ ...f, category, showroomId: showroomsFor(category)[0]?.id ?? '' }));
  };

  const mrpNumber = Number(form.mrp);
  const exclusive = Number.isFinite(mrpNumber) && mrpNumber > 0 ? mrpNumber / (1 + Number(form.gstRate) / 100) : null;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { product } = await api.pos.addProduct({ barcode, ...form, gstRate: Number(form.gstRate), stock: form.stock === '' ? 0 : Number(form.stock) });
      toast({ tone: 'success', title: `${product.name} added`, description: `Scan ${product.barcode} to add it to a bag.` });
      onAdded?.(product);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Add a product" description="Scan any product barcode. New barcodes are added to the catalog." wide>
      {stage === 'scan' && (
        <div className="space-y-4">
          {scanning ? (
            <BarcodeScanner autoStart compact hint="Line up the product barcode" onDetected={(text) => lookup(text)} />
          ) : (
            <Button variant="secondary" className="w-full" icon={ScanBarcode} onClick={() => setScanning(true)}>
              Scan with camera
            </Button>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              lookup();
            }}
            className="flex gap-2"
          >
            <div className="min-w-0 flex-1">
              <Field id="barcode" ref={inputRef} label="Or type the barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="8906001234567" autoComplete="off" />
            </div>
            <Button type="submit" className="mt-6">
              Check
            </Button>
          </form>
          {error && <Alert tone="error">{error}</Alert>}
        </div>
      )}

      {stage === 'existing' && existing && (
        <div className="space-y-4">
          <Alert tone="info" title="Already in the catalog">
            {existing.name} ({formatINR(existing.mrp)} incl. GST, {existing.showroom}) is already set up for barcode {existing.barcode}.
          </Alert>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStage('scan')}>
              Scan another
            </Button>
            <Button variant="dark" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      )}

      {stage === 'form' && (
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800 ring-1 ring-inset ring-emerald-200">
            <CheckCircle2 className="size-4" /> New barcode <span className="font-mono font-semibold">{barcode}</span>
          </div>
          <Field id="name" label="Product name" value={form.name} onChange={setField('name')} placeholder="Steel Water Bottle" required />
          <Field id="description" label="Description (optional)" value={form.description} onChange={setField('description')} placeholder="750 ml, insulated" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="mrp" label="MRP incl. GST (Rs.)" type="number" min="1" step="0.01" inputMode="decimal" value={form.mrp} onChange={setField('mrp')} placeholder="899" required />
            <Field id="stock" label="Stock on hand" type="number" min="0" step="1" inputMode="numeric" value={form.stock} onChange={setField('stock')} placeholder="0" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[13px] font-semibold text-zinc-700">Category</span>
              <select value={form.category} onChange={setCategory} className="mt-1.5 h-12 w-full rounded-xl bg-white px-3 text-[15px] text-zinc-900 shadow-card ring-1 ring-inset ring-zinc-200 outline-none focus:ring-2 focus:ring-brand-500">
                {(catalog?.categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold text-zinc-700">Showroom</span>
              <select value={form.showroomId} onChange={setField('showroomId')} className="mt-1.5 h-12 w-full rounded-xl bg-white px-3 text-[15px] text-zinc-900 shadow-card ring-1 ring-inset ring-zinc-200 outline-none focus:ring-2 focus:ring-brand-500">
                {showroomsFor(form.category).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[13px] font-semibold text-zinc-700">GST rate</span>
              <select value={form.gstRate} onChange={setField('gstRate')} className="mt-1.5 h-12 w-full rounded-xl bg-white px-3 text-[15px] text-zinc-900 shadow-card ring-1 ring-inset ring-zinc-200 outline-none focus:ring-2 focus:ring-brand-500">
                {GST_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r}%
                  </option>
                ))}
              </select>
            </label>
            <Field id="hsn" label="HSN code (optional)" inputMode="numeric" value={form.hsn} onChange={setField('hsn')} placeholder="6205" />
          </div>
          {exclusive !== null && (
            <p className="rounded-xl bg-zinc-50 px-3 py-2 text-[13px] text-zinc-600 ring-1 ring-inset ring-zinc-200">
              Taxable value {formatINR(exclusive)} + GST {formatINR(mrpNumber - exclusive)} = {formatINR(mrpNumber)} on the bill.
            </p>
          )}
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStage('scan')} type="button">
              Back
            </Button>
            <Button type="submit" className="flex-1" icon={PackagePlus} loading={busy}>
              Add product to catalog
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
