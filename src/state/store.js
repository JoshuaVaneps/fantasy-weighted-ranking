export function shallowEqual(a, b) {
  if (a === b) return true;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => Object.is(a[key], b[key]));
}

export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  function getState() {
    return state;
  }

  function setState(update) {
    const partial = typeof update === 'function' ? update(state) : update;
    const nextState = { ...state, ...partial };

    if (shallowEqual(nextState, state)) return;

    state = nextState;
    for (const listener of listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('Store listener threw:', err);
      }
    }
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { getState, setState, subscribe };
}
