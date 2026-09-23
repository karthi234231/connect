import { useSyncExternalStore } from 'react'

export interface Store<T> {
  subscribe: (listener: () => void) => () => void
  getState: () => T
  setState: (partial: Partial<T> | ((prev: T) => Partial<T>)) => void
}

export function createStore<T>(initialState: T): Store<T> {
  let state = initialState
  const listeners = new Set<() => void>()

  const getState = () => state

  const setState = (partial: Partial<T> | ((prev: T) => Partial<T>)) => {
    const next = typeof partial === 'function' ? partial(state) : partial
    state = { ...state, ...next }
    listeners.forEach((listener) => listener())
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  return { subscribe, getState, setState }
}

export function useStore<T, S>(store: Store<T>, selector: (state: T) => S): S {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  )
}
