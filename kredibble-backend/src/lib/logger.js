import pino from 'pino';

let loggerPromise;

const getLogger = () => {
  if (!loggerPromise) {
    loggerPromise = (async () => {
      const { env } = await import('../config/env.js');
      const isDevelopment = env.nodeEnv !== 'production';

      return pino({
        level: env.logLevel || (isDevelopment ? 'debug' : 'info'),
        transport: isDevelopment ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        } : undefined,
        base: {
          service: 'kredibble-backend',
        },
      });
    })();
  }
  return loggerPromise;
};

const createChildLogger = (bindings) => getLogger().then(l => l.child(bindings));

// Proxy to support logger.info(), logger.warn(), etc. before initialization
export default new Proxy({}, {
  get(_, prop) {
    const logPromise = getLogger();
    // Return a function that awaits the logger and calls the method
    return (...args) => logPromise.then(log => log[prop](...args));
  },
});

export { createChildLogger };