// Simple dev-only logger helpers to reduce noise in production
const isDev =
  typeof import.meta !== 'undefined' &&
  import.meta.env &&
  import.meta.env.MODE === 'development';

export const devLog = (...args) => {
  if (isDev) console.log(...args);
};

export const devWarn = (...args) => {
  if (isDev) console.warn(...args);
};

export const devError = (...args) => {
  if (isDev) console.error(...args);
};

export default { devLog, devWarn, devError };
