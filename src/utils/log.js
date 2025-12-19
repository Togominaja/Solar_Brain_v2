function info(...args) {
  console.log("[SB]", ...args);
}
function warn(...args) {
  console.warn("[SB WARN]", ...args);
}
function error(...args) {
  console.error("[SB ERROR]", ...args);
}

function safeErr(err) {
  if (!err) return err;
  return {
    name: err?.name,
    message: err?.message || String(err),
    stack: err?.stack
  };
}

module.exports = { info, warn, error, safeErr };
