import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, SIGNED_OUT_EVENT, api, authStore } from '../lib/api.js';
import { navigate } from '../lib/router.js';

const SESSION_GONE = new Set(['SESSION_NOT_FOUND', 'SESSION_EXPIRED']);

const ShopContext = createContext(null);

/**
 * Customer-side state: the signed-in shopper (by phone), their open bag and its
 * server-computed cart, plus the catalog and app config. The server is the
 * source of truth for every total.
 */
export function ShopProvider({ children }) {
  const [customer, setCustomer] = useState(() => authStore.get('customer'));
  const [config, setConfig] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [cart, setCart] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [error, setError] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [recentScans, setRecentScans] = useState([]);

  const sessionRef = useRef(null);
  const bootPromise = useRef(null);
  const catalogRef = useRef(null);
  const catalogLoadedAt = useRef(0);

  const resetBag = useCallback(() => {
    bootPromise.current = null;
    sessionRef.current = null;
    setSessionId(null);
    setCart(null);
    setRecentScans([]);
    setStatus('idle');
    setError(null);
  }, []);

  /** Opens (or resumes) the customer's bag on the server and loads its cart. */
  const openBag = useCallback(async () => {
    const session = await api.createSession();
    sessionRef.current = session.sessionId;
    setSessionId(session.sessionId);
    const fresh = await api.cart(session.sessionId);
    setCart(fresh);
    return fresh;
  }, []);

  const ensureSession = useCallback(() => {
    if (bootPromise.current) return bootPromise.current;
    bootPromise.current = (async () => {
      setStatus('loading');
      setError(null);
      try {
        const fresh = await openBag();
        setStatus('ready');
        return fresh;
      } catch (err) {
        setError(err);
        setStatus('error');
        bootPromise.current = null;
        throw err;
      }
    })();
    return bootPromise.current;
  }, [openBag]);

  /** Runs a cart mutation; transparently reopens the bag once if it expired. */
  const withSession = useCallback(
    async (fn) => {
      await ensureSession();
      try {
        return await fn(sessionRef.current);
      } catch (err) {
        if (err instanceof ApiError && SESSION_GONE.has(err.code)) {
          await openBag();
          return fn(sessionRef.current);
        }
        throw err;
      }
    },
    [ensureSession, openBag],
  );

  // ---------- Auth ----------
  const login = useCallback(
    async (phone) => {
      const res = await api.auth.customerLogin(phone);
      const account = { token: res.token, id: res.customer.id, phone: res.customer.phone };
      authStore.set('customer', account);
      resetBag();
      setCustomer(account);
      return res.customer;
    },
    [resetBag],
  );

  const logout = useCallback(() => {
    authStore.clear('customer');
    resetBag();
    setCustomer(null);
    navigate('/login', { replace: true });
  }, [resetBag]);

  useEffect(() => {
    const onSignedOut = (e) => {
      if (e.detail?.role !== 'customer') return;
      resetBag();
      setCustomer(null);
      navigate('/login', { replace: true });
    };
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut);
  }, [resetBag]);

  // ---------- Cart ----------
  const addByBarcode = useCallback(
    (code, quantity = 1) =>
      withSession(async (sid) => {
        const res = await api.addToCart(sid, code, quantity);
        setCart(res.cart);
        setRecentScans((list) =>
          [{ ...res.item, scannedAt: new Date().toISOString(), added: res.added }, ...list.filter((i) => i.itemId !== res.item.itemId)].slice(0, 6),
        );
        return res;
      }),
    [withSession],
  );

  const setQuantity = useCallback(
    (itemId, quantity) =>
      withSession(async (sid) => {
        // Optimistic: reflect the new quantity instantly, then reconcile with server totals.
        const apply = (items) => items.map((i) => (i.itemId === itemId ? { ...i, quantity } : i));
        setCart((c) => (c ? { ...c, items: apply(c.items), groups: c.groups.map((g) => ({ ...g, items: apply(g.items) })) } : c));
        try {
          const next = await api.updateItem(sid, itemId, quantity);
          setCart(next);
          if (quantity === 0) setRecentScans((list) => list.filter((i) => i.itemId !== itemId));
          return next;
        } catch (err) {
          api.cart(sid).then(setCart).catch(() => {});
          throw err;
        }
      }),
    [withSession],
  );

  const removeItem = useCallback(
    (itemId) =>
      withSession(async (sid) => {
        const next = await api.removeItem(sid, itemId);
        setCart(next);
        setRecentScans((list) => list.filter((i) => i.itemId !== itemId));
        return next;
      }),
    [withSession],
  );

  const refreshCart = useCallback(
    () =>
      withSession(async (sid) => {
        const next = await api.cart(sid);
        setCart(next);
        return next;
      }),
    [withSession],
  );

  const loadCatalog = useCallback(async ({ force = false } = {}) => {
    if (!force && catalogRef.current && Date.now() - catalogLoadedAt.current < 30_000) return catalogRef.current;
    const data = await api.products();
    catalogLoadedAt.current = Date.now();
    catalogRef.current = data;
    setCatalog(data);
    return data;
  }, []);

  /** Called after checkout: the next visit to the shop opens a fresh bag. */
  const completeCheckout = useCallback(() => {
    catalogLoadedAt.current = 0;
    resetBag();
  }, [resetBag]);

  useEffect(() => {
    api.config().then(setConfig).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({
      customer,
      config,
      sessionId,
      cart,
      status,
      error,
      catalog,
      recentScans,
      units: cart?.summary.units ?? 0,
      login,
      logout,
      ensureSession,
      addByBarcode,
      setQuantity,
      removeItem,
      refreshCart,
      loadCatalog,
      completeCheckout,
    }),
    [customer, config, sessionId, cart, status, error, catalog, recentScans, login, logout, ensureSession, addByBarcode, setQuantity, removeItem, refreshCart, loadCatalog, completeCheckout],
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export const useShop = () => {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used within <ShopProvider>');
  return ctx;
};
