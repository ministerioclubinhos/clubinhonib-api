function createLogger() {
  function ts() {
    return new Date().toISOString();
  }
  return {
    info: (msg) => console.log(`${ts()} INFO  ${msg}`),
    warn: (msg) => console.warn(`${ts()} WARN  ${msg}`),
    error: (msg) => console.error(`${ts()} ERROR ${msg}`),
  };
}

module.exports = { createLogger };


