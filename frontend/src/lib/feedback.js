let ctx;

/** Short scanner "beep" + haptic tick. Fails silently where unsupported. */
export const scanFeedback = (kind = 'success') => {
  try {
    navigator.vibrate?.(kind === 'success' ? 35 : [60, 40, 60]);
  } catch {
    /* ignore */
  }
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = kind === 'success' ? 1480 : 220;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (kind === 'success' ? 0.12 : 0.28));
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    /* ignore */
  }
};
