import { Camera, Clock3, LogOut, Moon, ScanBarcode, Search, UserRound } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppHeader } from '../../components/AppHeader.jsx';
import { BarcodeScanner } from '../../components/BarcodeScanner.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Sheet } from '../../components/ui/Sheet.jsx';
import { Card, Spinner } from '../../components/ui/misc.jsx';
import { SIGNED_OUT_EVENT, api, authStore } from '../../lib/api.js';
import { scanFeedback } from '../../lib/feedback.js';
import CashierLogin from './CashierLogin.jsx';
import { CollectCash, CollectedCard } from './CollectCash.jsx';
import { DayReport, DrawerPanel, EndDaySheet } from './DrawerPanel.jsx';
import { PendingBills } from './PendingBills.jsx';
import { StartDay } from './StartDay.jsx';

const POLL_MS = 5000;

const LOOKUP_TONES = { NO_PENDING_BILL: 'warning', BILL_NOT_FOUND: 'error' };

/**
 * Cash desk for cashiers. Only deals with cash: find a customer's unpaid bill,
 * work out the change, and keep the day's drawer total through to closing.
 */
export default function CashDesk() {
  const [cashier, setCashier] = useState(() => authStore.get('cashier'));
  const [signOutNotice, setSignOutNotice] = useState(null);

  useEffect(() => {
    const onSignedOut = (e) => {
      if (e.detail?.role !== 'cashier') return;
      setCashier(null);
      setSignOutNotice(e.detail.reason);
    };
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut);
  }, []);

  const signOut = () => {
    authStore.clear('cashier');
    setCashier(null);
    setSignOutNotice(null);
  };

  if (!cashier) {
    return (
      <CashierLogin
        notice={signOutNotice}
        onLogin={(account) => {
          setSignOutNotice(null);
          setCashier(account);
        }}
      />
    );
  }
  return <Desk key={cashier.id} cashier={cashier} onSignOut={signOut} />;
}

function Desk({ cashier, onSignOut }) {
  const [shiftState, setShiftState] = useState({ loading: true, shift: null, lastClosed: null, error: null });
  const [report, setReport] = useState(null);
  const [pending, setPending] = useState({ loading: true, bills: [] });
  const [selected, setSelected] = useState(null);
  const [collected, setCollected] = useState(null);
  const [code, setCode] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [endDayOpen, setEndDayOpen] = useState(false);
  const lookupRef = useRef(null);

  const loadShift = useCallback(async () => {
    try {
      const { shift, lastClosed } = await api.pos.shift();
      setShiftState({ loading: false, shift, lastClosed, error: null });
    } catch (err) {
      setShiftState((s) => ({ ...s, loading: false, error: err }));
    }
  }, []);

  const loadPending = useCallback(async () => {
    try {
      const { bills } = await api.pos.pending();
      setPending({ loading: false, bills });
    } catch {
      setPending((p) => ({ ...p, loading: false }));
    }
  }, []);

  const shiftOpen = Boolean(shiftState.shift);

  useEffect(() => {
    loadShift();
  }, [loadShift]);

  // Live refresh while the desk is open.
  useEffect(() => {
    if (!shiftOpen) return undefined;
    loadPending();
    const t = setInterval(() => {
      loadPending();
      loadShift();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [shiftOpen, loadPending, loadShift]);

  const lookup = async (raw) => {
    const value = String(raw ?? code).trim();
    if (!value) return;
    setLookingUp(true);
    setLookupError(null);
    try {
      const { bill } = await api.pos.lookup(value);
      setSelected(bill);
      setCollected(null);
      setCode('');
      scanFeedback('success');
    } catch (err) {
      setLookupError(err);
      scanFeedback('error');
      lookupRef.current?.select();
    } finally {
      setLookingUp(false);
    }
  };

  const nextCustomer = () => {
    setSelected(null);
    setCollected(null);
    setTimeout(() => lookupRef.current?.focus(), 50);
  };

  // ---------- Gates: loading → day closed report → start day ----------
  const header = (
    <AppHeader
      suffix="Cash desk"
      maxWidth="max-w-6xl"
      center={<DeskClock name={cashier.name} />}
      right={
        <>
          {shiftOpen && (
            <Button variant="secondary" size="sm" icon={Moon} onClick={() => setEndDayOpen(true)} className="max-sm:hidden">
              End day
            </Button>
          )}
          <Button variant="ghost" size="sm" icon={LogOut} onClick={onSignOut}>
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </>
      }
    />
  );

  if (shiftState.loading) {
    return (
      <div className="min-h-dvh">
        {header}
        <div className="grid place-items-center py-40 text-zinc-400">
          <Spinner className="size-6" />
        </div>
      </div>
    );
  }

  if (report) {
    return (
      <div className="min-h-dvh">
        {header}
        <DayReport
          report={report}
          cashier={cashier}
          onSignOut={onSignOut}
          onStartNew={() => {
            setReport(null);
            loadShift();
          }}
        />
      </div>
    );
  }

  if (!shiftState.shift) {
    return (
      <div className="min-h-dvh">
        {header}
        {shiftState.error && (
          <div className="mx-auto max-w-4xl px-4 pt-6 sm:px-6">
            <Alert tone="error" title="Couldn’t load your drawer">{shiftState.error.message}</Alert>
          </div>
        )}
        <StartDay
          cashier={cashier}
          lastClosed={shiftState.lastClosed}
          onStarted={(shift) => setShiftState({ loading: false, shift, lastClosed: null, error: null })}
        />
      </div>
    );
  }

  // ---------- Open desk ----------
  return (
    <div className="min-h-dvh">
      {header}

      <main className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] items-start gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 space-y-4">
          <Card className="p-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                lookup();
              }}
              className="flex gap-2"
            >
              <label className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-3.5 transition focus-within:bg-zinc-50">
                <ScanBarcode className="size-5 shrink-0 text-zinc-400" />
                <input
                  ref={lookupRef}
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Scan bill barcode, or enter customer phone / bill ID"
                  className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Bill barcode, customer phone or bill ID"
                />
              </label>
              <Button variant="secondary" size="lg" icon={Camera} onClick={() => setScanning(true)} className="max-sm:hidden">
                Scan
              </Button>
              <Button variant="secondary" size="icon" className="h-12 w-12 sm:hidden" onClick={() => setScanning(true)} aria-label="Scan bill barcode">
                <Camera className="size-5" />
              </Button>
              <Button type="submit" size="lg" icon={Search} loading={lookingUp}>
                <span className="hidden sm:inline">Find bill</span>
              </Button>
            </form>
          </Card>

          {lookupError && (
            <Alert tone={LOOKUP_TONES[lookupError.code] ?? 'error'} onDismiss={() => setLookupError(null)}>
              {lookupError.message}
            </Alert>
          )}

          {collected ? (
            <CollectedCard result={collected} onNext={nextCustomer} />
          ) : selected ? (
            <CollectCash
              key={selected.transactionId}
              bill={selected}
              onClose={nextCustomer}
              onCollected={(res) => {
                setCollected(res);
                setShiftState((s) => ({ ...s, shift: res.drawer }));
                loadPending();
              }}
            />
          ) : null}

          <PendingBills
            bills={pending.bills}
            loading={pending.loading}
            activeId={selected?.transactionId}
            onSelect={(bill) => {
              setSelected(bill);
              setCollected(null);
              setLookupError(null);
            }}
          />
        </section>

        <aside className="space-y-4 lg:sticky lg:top-[5.25rem]">
          <DrawerPanel shift={shiftState.shift} onEndDay={() => setEndDayOpen(true)} />
        </aside>
      </main>

      <EndDaySheet
        open={endDayOpen}
        shift={shiftState.shift}
        onClose={() => setEndDayOpen(false)}
        onClosed={(r) => {
          setEndDayOpen(false);
          setSelected(null);
          setCollected(null);
          setReport(r);
          setShiftState({ loading: false, shift: null, lastClosed: r, error: null });
        }}
      />

      <Sheet open={scanning} onClose={() => setScanning(false)} title="Scan bill barcode" description="Point the camera at the barcode on the customer’s receipt." wide>
        {scanning && (
          <BarcodeScanner
            autoStart
            compact
            hint="Line up the bill barcode"
            onDetected={(text) => {
              setScanning(false);
              lookup(text);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function DeskClock({ name }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-3 text-[13px]">
      <span className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-2.5 py-1.5 font-semibold text-white">
        <UserRound className="size-3.5" /> {name}
      </span>
      <span className="inline-flex items-center gap-1.5 font-medium text-zinc-500 tabular-nums">
        <Clock3 className="size-3.5" />
        {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
      </span>
    </div>
  );
}
