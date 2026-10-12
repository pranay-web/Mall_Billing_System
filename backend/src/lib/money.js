/**
 * All arithmetic happens in integer paise to avoid floating-point drift;
 * values are converted back to rupees (2 dp) only at the API boundary.
 */
export const toPaise = (rupees) => Math.round(rupees * 100);
export const toRupees = (paise) => Math.round(paise) / 100;
