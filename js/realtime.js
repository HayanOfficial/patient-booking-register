// Realtime connection indicator and event dispatch helpers
import { api } from './api.js';

let _unsubscribe = null;

/**
 * Subscribe to realtime events and update connection indicator
 * @param {function} onEvent - called with { event, record }
 * @param {string} indicatorSelector - CSS selector for the connection indicator element
 */
export function startRealtime(onEvent, indicatorSelector = '#realtime-indicator') {
  const indicator = document.querySelector(indicatorSelector);

  function setStatus(status) {
    if (!indicator) return;
    indicator.className = `realtime-indicator realtime-indicator--${status}`;
    indicator.title = status === 'connected' ? 'Live' : status === 'reconnecting' ? 'Reconnecting...' : 'Offline';
    indicator.textContent = status === 'connected' ? '● Live' : status === 'reconnecting' ? '◌ Reconnecting' : '○ Offline';
  }

  _unsubscribe = api.subscribeToRealtime(onEvent, setStatus);

  // Refetch on tab visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      onEvent({ event: 'tab_visible', record: null });
    }
  });

  return _unsubscribe;
}

export function stopRealtime() {
  if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
}
