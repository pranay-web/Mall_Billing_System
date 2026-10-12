const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let loader = null;

/** Lazily injects Razorpay Checkout once; rejects with a helpful message if it can't load. */
export const loadRazorpay = () => {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () =>
      window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Razorpay Checkout failed to initialise.'));
    script.onerror = () => {
      loader = null;
      script.remove();
      reject(new Error('Could not load Razorpay Checkout. Check your internet connection or disable ad-blockers.'));
    };
    document.head.appendChild(script);
  });
  return loader;
};
