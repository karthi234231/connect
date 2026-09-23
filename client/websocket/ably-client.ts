import Ably from 'ably'

export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'offline'
  | 'closed'

export type NetworkStatus = 'online' | 'offline'

export interface AblyClientOptions {
  token?: string
  tokenUrl?: string
  authCallback?: () => Promise<string>
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  dedupeWindowMs?: number
  dedupeCacheSize?: number
  jitter?: boolean
}

export interface AblyMessage<T = unknown> {
  id: string
  name: string
  data: T
  timestamp?: number
  clientId?: string
  connectionId?: string
}

export type MessageHandler<T = unknown> = (message: AblyMessage<T>) => void
export type StatusChangeHandler = (status: {
  connectionState: ConnectionState
  networkStatus: NetworkStatus
}) => void

/**
 * Calculates exponential backoff delay with optional jitter.
 */
export function calculateBackoffDelay(
  retryCount: number,
  baseDelayMs = 1000,
  maxDelayMs = 30000,
  jitter = true,
): number {
  const exponential = baseDelayMs * Math.pow(2, Math.min(retryCount, 10))
  const capped = Math.min(maxDelayMs, exponential)
  if (!jitter) return capped
  // Apply random jitter between 80% and 120% of capped delay
  const randomFactor = 0.8 + Math.random() * 0.4
  return Math.floor(capped * randomFactor)
}

/**
 * Message Deduplicator using LRU + TTL cache to filter duplicate inbound realtime events.
 */
export class MessageDeduplicator {
  private seenIds = new Map<string, number>()
  private readonly maxSize: number
  private readonly ttlMs: number

  constructor(maxSize = 1000, ttlMs = 300000) {
    this.maxSize = maxSize
    this.ttlMs = ttlMs
  }

  /**
   * Returns true if the message ID has already been seen (duplicate).
   */
  public isDuplicate(id: string): boolean {
    if (!id) return false
    this.purgeExpired()
    return this.seenIds.has(id)
  }

  /**
   * Tracks a message ID. Returns true if NEW (not duplicate), false if already seen.
   */
  public track(id: string): boolean {
    if (!id) return true
    this.purgeExpired()
    if (this.seenIds.has(id)) {
      return false
    }

    if (this.seenIds.size >= this.maxSize) {
      // Remove oldest entry
      const oldestKey = this.seenIds.keys().next().value
      if (oldestKey !== undefined) {
        this.seenIds.delete(oldestKey)
      }
    }

    this.seenIds.set(id, Date.now())
    return true
  }

  /**
   * Purges messages older than ttlMs.
   */
  public purgeExpired(): void {
    const now = Date.now()
    for (const [id, timestamp] of this.seenIds.entries()) {
      if (now - timestamp > this.ttlMs) {
        this.seenIds.delete(id)
      } else {
        // Map maintains insertion order, so if this one isn't expired, remaining ones aren't either
        break
      }
    }
  }

  /**
   * Clears all cached IDs.
   */
  public clear(): void {
    this.seenIds.clear()
  }

  public get size(): number {
    return this.seenIds.size
  }
}

/**
 * Monitor for browser online/offline status signals.
 */
export class NetworkMonitor {
  private listeners = new Set<(online: boolean) => void>()
  private isBrowser = typeof window !== 'undefined'
  private _isOnline = this.isBrowser ? (navigator.onLine ?? true) : true

  constructor() {
    if (this.isBrowser) {
      window.addEventListener('online', this.handleOnline)
      window.addEventListener('offline', this.handleOffline)
    }
  }

  private handleOnline = () => {
    this._isOnline = true
    this.notify()
  }

  private handleOffline = () => {
    this._isOnline = false
    this.notify()
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this._isOnline))
  }

  public isOnline(): boolean {
    if (this.isBrowser) {
      return navigator.onLine ?? true
    }
    return this._isOnline
  }

  public subscribe(listener: (online: boolean) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  public destroy(): void {
    if (this.isBrowser) {
      window.removeEventListener('online', this.handleOnline)
      window.removeEventListener('offline', this.handleOffline)
    }
    this.listeners.clear()
  }
}

/**
 * Ably Realtime Client Manager with exponential backoff connection retries,
 * online/offline status signals, and message deduplication.
 */
export class AblyRealtimeClient {
  private client: Ably.Realtime | null = null
  private connectionState: ConnectionState = 'idle'
  private retryCount = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private options: Required<
    Omit<AblyClientOptions, 'token' | 'tokenUrl' | 'authCallback'>
  > &
    Pick<AblyClientOptions, 'token' | 'tokenUrl' | 'authCallback'>
  private deduplicator: MessageDeduplicator
  private networkMonitor: NetworkMonitor
  private statusListeners = new Set<StatusChangeHandler>()
  private channelSubscriptions = new Map<
    string,
    Set<{ eventName: string; handler: MessageHandler }>
  >()
  private closed = false

  constructor(options: AblyClientOptions = {}) {
    this.options = {
      token: options.token,
      tokenUrl: options.tokenUrl,
      authCallback: options.authCallback,
      maxRetries: options.maxRetries ?? 10,
      baseDelayMs: options.baseDelayMs ?? 1000,
      maxDelayMs: options.maxDelayMs ?? 30000,
      dedupeWindowMs: options.dedupeWindowMs ?? 300000,
      dedupeCacheSize: options.dedupeCacheSize ?? 1000,
      jitter: options.jitter ?? true,
    }

    this.deduplicator = new MessageDeduplicator(
      this.options.dedupeCacheSize,
      this.options.dedupeWindowMs,
    )

    this.networkMonitor = new NetworkMonitor()
    this.networkMonitor.subscribe(this.handleNetworkChange)
  }

  public get state(): ConnectionState {
    return this.connectionState
  }

  public get networkStatus(): NetworkStatus {
    return this.networkMonitor.isOnline() ? 'online' : 'offline'
  }

  public onStatusChange(handler: StatusChangeHandler): () => void {
    this.statusListeners.add(handler)
    handler({
      connectionState: this.connectionState,
      networkStatus: this.networkStatus,
    })
    return () => {
      this.statusListeners.delete(handler)
    }
  }

  private setConnectionState(newState: ConnectionState) {
    if (this.connectionState === newState) return
    this.connectionState = newState
    const currentNetwork = this.networkStatus
    this.statusListeners.forEach((listener) =>
      listener({
        connectionState: newState,
        networkStatus: currentNetwork,
      }),
    )
  }

  private handleNetworkChange = (isOnline: boolean) => {
    if (!isOnline) {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
      }
      this.setConnectionState('offline')
    } else {
      if (this.connectionState === 'offline' || this.connectionState === 'reconnecting') {
        this.retryCount = 0
        this.connect()
      }
    }
  }

  public async connect(): Promise<void> {
    if (this.closed) return
    if (!this.networkMonitor.isOnline()) {
      this.setConnectionState('offline')
      return
    }

    if (this.connectionState === 'connected' && this.client) return

    this.setConnectionState(
      this.retryCount === 0 ? 'connecting' : 'reconnecting',
    )

    try {
      let token = this.options.token
      if (!token && this.options.authCallback) {
        token = await this.options.authCallback()
      }

      const ablyOptions: Ably.ClientOptions = {
        autoConnect: true,
      }

      if (token) {
        ablyOptions.token = token
      } else if (this.options.tokenUrl) {
        ablyOptions.authUrl = this.options.tokenUrl
      }

      this.client = new Ably.Realtime(ablyOptions)

      this.client.connection.on('connected', () => {
        this.retryCount = 0
        this.setConnectionState('connected')
        this.resubscribeChannels()
      })

      this.client.connection.on('disconnected', () => {
        this.scheduleReconnect()
      })

      this.client.connection.on('suspended', () => {
        this.scheduleReconnect()
      })

      this.client.connection.on('failed', () => {
        this.scheduleReconnect()
      })
    } catch {
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.closed) return
    if (!this.networkMonitor.isOnline()) {
      this.setConnectionState('offline')
      return
    }

    if (this.retryCount >= this.options.maxRetries) {
      this.setConnectionState('closed')
      return
    }

    const delay = calculateBackoffDelay(
      this.retryCount,
      this.options.baseDelayMs,
      this.options.maxDelayMs,
      this.options.jitter,
    )

    this.retryCount += 1
    this.setConnectionState('reconnecting')

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => {
      void this.connect()
    }, delay)
  }

  private resubscribeChannels() {
    if (!this.client) return
    for (const [channelName, subs] of this.channelSubscriptions.entries()) {
      const channel = this.client.channels.get(channelName)
      for (const sub of subs) {
        void channel.subscribe(sub.eventName, (msg) => {
          this.handleInboundMessage(msg, sub.handler)
        })
      }
    }
  }

  private handleInboundMessage(
    rawMessage: Ably.InboundMessage,
    handler: MessageHandler,
  ) {
    const msgId = rawMessage.id || `${rawMessage.name}:${JSON.stringify(rawMessage.data)}`
    // Deduplicate incoming messages before calling handlers
    if (!this.deduplicator.track(msgId)) {
      return
    }

    const message: AblyMessage = {
      id: msgId,
      name: rawMessage.name ?? '',
      data: rawMessage.data,
      timestamp: rawMessage.timestamp,
      clientId: rawMessage.clientId,
      connectionId: rawMessage.connectionId,
    }

    handler(message)
  }

  public subscribe<T = unknown>(
    channelName: string,
    eventName: string,
    handler: MessageHandler<T>,
  ): () => void {
    if (this.connectionState === 'idle') {
      void this.connect()
    }

    if (!this.channelSubscriptions.has(channelName)) {
      this.channelSubscriptions.set(channelName, new Set())
    }

    const subs = this.channelSubscriptions.get(channelName)!
    const entry = { eventName, handler: handler as MessageHandler }
    subs.add(entry)

    if (this.client && this.connectionState === 'connected') {
      const channel = this.client.channels.get(channelName)
      void channel.subscribe(eventName, (rawMsg) => {
        this.handleInboundMessage(rawMsg, handler as MessageHandler)
      })
    }

    return () => {
      subs.delete(entry)
      if (subs.size === 0) {
        this.channelSubscriptions.delete(channelName)
      }
      if (this.client) {
        const channel = this.client.channels.get(channelName)
        channel.unsubscribe(eventName)
      }
    }
  }

  public async publish(
    channelName: string,
    eventName: string,
    data: unknown,
  ): Promise<void> {
    if (!this.client || this.connectionState !== 'connected') {
      throw new Error('Cannot publish when realtime client is not connected')
    }
    const channel = this.client.channels.get(channelName)
    await channel.publish(eventName, data)
  }

  public getDeduplicator(): MessageDeduplicator {
    return this.deduplicator
  }

  public close(): void {
    this.closed = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.networkMonitor.destroy()
    this.channelSubscriptions.clear()
    this.statusListeners.clear()
    this.deduplicator.clear()
    if (this.client) {
      this.client.close()
      this.client = null
    }
    this.setConnectionState('closed')
  }
}

/**
 * Creates an AblyRealtimeClient instance.
 */
export function createAblyClient(
  options: AblyClientOptions = {},
): AblyRealtimeClient {
  return new AblyRealtimeClient(options)
}
