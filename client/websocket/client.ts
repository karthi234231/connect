export type RealtimeConnectionState =
  'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed'

export interface RealtimeEvent {
  channel: string
  name: string
  data: unknown
}

export type RealtimeEventHandler = (event: RealtimeEvent) => void

export interface RealtimeClient {
  subscribe: (channel: string, onEvent: RealtimeEventHandler) => () => void
  close: () => void
  readonly connectionState: RealtimeConnectionState
}

export interface RealtimeConfig {
  url: string | (() => string)
  protocols?: string | string[]
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
}

const MAX_RETRY_DELAY_MS = 30_000

export function connectRealtime(config: RealtimeConfig): RealtimeClient {
  const {
    url,
    protocols,
    maxRetries = Infinity,
    baseDelayMs = 1000,
    maxDelayMs = MAX_RETRY_DELAY_MS,
  } = config

  let socket: WebSocket | null = null
  let state: RealtimeConnectionState = 'idle'
  let retries = 0
  let closed = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  const listeners = new Map<string, Set<RealtimeEventHandler>>()

  const resolveUrl = () => (typeof url === 'function' ? url() : url)

  const setState = (next: RealtimeConnectionState) => {
    state = next
  }

  const dispatch = (raw: string) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return
    }

    if (typeof parsed !== 'object' || parsed === null) return

    const { channel, name, data } = parsed as {
      channel?: unknown
      name?: unknown
      data?: unknown
    }

    if (typeof channel !== 'string' || typeof name !== 'string') return

    const handlers = listeners.get(channel)
    if (!handlers) return

    const event: RealtimeEvent = { channel, name, data }
    handlers.forEach((handler) => handler(event))
  }

  const scheduleReconnect = () => {
    if (closed) return

    if (retries >= maxRetries) {
      setState('closed')
      return
    }

    const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.min(retries, 10))
    retries += 1
    setState('reconnecting')
    reconnectTimer = setTimeout(connect, delay)
  }

  function connect(): void {
    if (closed) return

    setState(retries === 0 ? 'connecting' : 'reconnecting')

    try {
      socket = new WebSocket(resolveUrl(), protocols)
    } catch {
      scheduleReconnect()
      return
    }

    socket.onopen = () => {
      retries = 0
      setState('connected')
    }

    socket.onmessage = (message) => dispatch(message.data)

    socket.onerror = () => {
      socket?.close()
    }

    socket.onclose = () => {
      if (closed) return
      scheduleReconnect()
    }
  }

  const subscribe = (
    channel: string,
    onEvent: RealtimeEventHandler,
  ): (() => void) => {
    if (state === 'idle') connect()

    const handlers = listeners.get(channel) ?? new Set<RealtimeEventHandler>()
    handlers.add(onEvent)
    listeners.set(channel, handlers)

    return () => {
      handlers.delete(onEvent)
      if (handlers.size === 0) listeners.delete(channel)
    }
  }

  const close = () => {
    closed = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    listeners.clear()
    socket?.close()
    socket = null
    setState('closed')
  }

  return {
    subscribe,
    close,
    get connectionState() {
      return state
    },
  }
}
