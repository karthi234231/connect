import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  calculateBackoffDelay,
  buildDedupeKey,
  MessageDeduplicator,
  NetworkMonitor,
  createAblyClient,
} from '@/client/websocket/ably-client'
import { AblyRealtimeClient } from '@/client/websocket/ably-client'

const mockAbly = vi.hoisted(() => {
  class MockConnection {
    handlers = new Map<string, Array<() => void>>()

    on(event: string, cb: () => void) {
      const arr = this.handlers.get(event) ?? []
      arr.push(cb)
      this.handlers.set(event, arr)
    }

    off(event: string, cb: () => void) {
      const arr = (this.handlers.get(event) ?? []).filter((h) => h !== cb)
      this.handlers.set(event, arr)
    }

    emit(event: string) {
      for (const cb of this.handlers.get(event) ?? []) cb()
    }
  }

  class MockChannel {
    listeners = new Map<string, Set<(msg: unknown) => void>>()

    constructor(public name: string) {}

    subscribe(event: string, cb: (msg: unknown) => void) {
      const set = this.listeners.get(event) ?? new Set<(msg: unknown) => void>()
      set.add(cb)
      this.listeners.set(event, set)
      return Promise.resolve(null)
    }

    unsubscribe(event?: string, cb?: (msg: unknown) => void) {
      if (event === undefined) {
        for (const set of this.listeners.values()) set.clear()
        return
      }
      const set = this.listeners.get(event)
      if (!set) return
      if (!cb) set.clear()
      else set.delete(cb)
    }

    emit(event: string, msg: unknown) {
      for (const cb of this.listeners.get(event) ?? []) cb(msg)
    }

    publish() {
      return Promise.resolve()
    }
  }

  class MockRealtime {
    static instances: MockRealtime[] = []
    static reset() {
      MockRealtime.instances = []
    }

    options: { [key: string]: unknown }
    connection = new MockConnection()
    closeLog = { called: false }
    channels = {
      inner: new Map<string, MockChannel>(),
      get: (name: string) => {
        let ch = this.channels.inner.get(name)
        if (!ch) {
          ch = new MockChannel(name)
          this.channels.inner.set(name, ch)
        }
        return ch
      },
    }

    constructor(options: { [key: string]: unknown }) {
      this.options = options
      MockRealtime.instances.push(this)
      // Fire 'connected' on the next timer tick so listeners are attached.
      setTimeout(() => this.connection.emit('connected'), 0)
    }

    close() {
      this.closeLog.called = true
    }
  }

  return { MockRealtime, MockChannel }
})

vi.mock('ably', () => ({ default: { Realtime: mockAbly.MockRealtime } }))

const latestInstance = () =>
  mockAbly.MockRealtime.instances[mockAbly.MockRealtime.instances.length - 1]!
const channelOf = (name: string, index = 0) =>
  mockAbly.MockRealtime.instances[index]!.channels.get(name)

const flush = () => vi.advanceTimersByTimeAsync(5)

const privateNet = (
  client: AblyRealtimeClient,
): { handleNetworkChange: (online: boolean) => void } =>
  client as unknown as { handleNetworkChange: (online: boolean) => void }

describe('ably-client — Exponential Backoff', () => {
  it('calculates exponential delay without jitter', () => {
    expect(calculateBackoffDelay(0, 1000, 30000, false)).toBe(1000)
    expect(calculateBackoffDelay(1, 1000, 30000, false)).toBe(2000)
    expect(calculateBackoffDelay(2, 1000, 30000, false)).toBe(4000)
    expect(calculateBackoffDelay(3, 1000, 30000, false)).toBe(8000)
    expect(calculateBackoffDelay(10, 1000, 30000, false)).toBe(30000)
  })

  it('caps delay at maxDelayMs', () => {
    expect(calculateBackoffDelay(20, 1000, 15000, false)).toBe(15000)
  })

  it('applies jitter within expected range when enabled', () => {
    const delay = calculateBackoffDelay(2, 1000, 30000, true)
    // base exponential = 4000, jitter range = [3200, 4800]
    expect(delay).toBeGreaterThanOrEqual(3200)
    expect(delay).toBeLessThanOrEqual(4800)
  })
})

describe('ably-client — Message Deduplicator', () => {
  let deduplicator: MessageDeduplicator

  beforeEach(() => {
    deduplicator = new MessageDeduplicator(5, 1000)
  })

  it('tracks new messages and identifies duplicates', () => {
    expect(deduplicator.isDuplicate('msg-1')).toBe(false)
    expect(deduplicator.track('msg-1')).toBe(true) // new
    expect(deduplicator.isDuplicate('msg-1')).toBe(true)
    expect(deduplicator.track('msg-1')).toBe(false) // duplicate
  })

  it('handles empty message IDs gracefully', () => {
    expect(deduplicator.isDuplicate('')).toBe(false)
    expect(deduplicator.track('')).toBe(true)
  })

  it('evicts oldest messages when max size is exceeded', () => {
    for (let i = 1; i <= 5; i++) {
      deduplicator.track(`msg-${i}`)
    }
    expect(deduplicator.size).toBe(5)

    // Adding 6th should evict msg-1
    deduplicator.track('msg-6')
    expect(deduplicator.size).toBe(5)
    expect(deduplicator.isDuplicate('msg-1')).toBe(false)
    expect(deduplicator.isDuplicate('msg-6')).toBe(true)
  })

  it('clears cache on demand', () => {
    deduplicator.track('msg-1')
    deduplicator.clear()
    expect(deduplicator.size).toBe(0)
    expect(deduplicator.isDuplicate('msg-1')).toBe(false)
  })
})

describe('ably-client — Dedupe key synthesis', () => {
  it('prefers the S032 envelope eventId over name+data', () => {
    const a = buildDedupeKey({
      name: 'message',
      data: { eventId: 'evt-1', payload: { content: 'hi' } },
    })
    const b = buildDedupeKey({
      name: 'message',
      data: { eventId: 'evt-2', payload: { content: 'hi' } },
    })
    expect(a).toBe('message:evt-1')
    expect(b).toBe('message:evt-2')
  })

  it('falls back to name+data when no eventId is present', () => {
    expect(buildDedupeKey({ name: 'message', data: { content: 'hi' } })).toBe(
      'message:{"content":"hi"}',
    )
    expect(buildDedupeKey({ data: 42 })).toBe(':42')
  })
})

describe('ably-client — Network Monitor', () => {
  it('reports online status', () => {
    const monitor = new NetworkMonitor()
    expect(typeof monitor.isOnline()).toBe('boolean')
    monitor.destroy()
  })
})

describe('ably-client — Client Instance', () => {
  it('instantiates AblyRealtimeClient with initial state', () => {
    const client = createAblyClient({ baseDelayMs: 500 })
    expect(client.state).toBe('idle')
    expect(client.networkStatus).toBe('online')
    client.close()
    expect(client.state).toBe('closed')
  })
})

describe('ably-client — Connection lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockAbly.MockRealtime.reset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('lazy-connects on first subscribe and delivers messages', async () => {
    const client = createAblyClient({ token: 'tok' })
    expect(mockAbly.MockRealtime.instances.length).toBe(0)

    const handler = vi.fn()
    const unsubscribe = client.subscribe('match:1', 'message', handler)

    await flush()
    expect(client.state).toBe('connected')
    expect(mockAbly.MockRealtime.instances.length).toBe(1)

    channelOf('match:1')!.emit('message', {
      id: 'm-1',
      name: 'message',
      data: { eventId: 'evt-1' },
    })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0]![0]).toMatchObject({
      id: 'm-1',
      name: 'message',
      data: { eventId: 'evt-1' },
    })

    unsubscribe()
    client.close()
  })

  it('builds Ably.ClientOptions with autoConnect + token option', async () => {
    const client = createAblyClient({ token: 'tok-abc' })
    client.subscribe('match:1', 'message', () => undefined)
    await flush()

    const built = latestInstance().options
    expect(built.autoConnect).toBe(true)
    expect(built.token).toBe('tok-abc')
    expect(built.authUrl).toBeUndefined()
    client.close()
  })

  it('uses authCallback when token is absent and wires Ably renewal', async () => {
    const authCallback = vi.fn(async () => 'tok-renew')
    const client = createAblyClient({ authCallback })
    client.subscribe('match:1', 'message', () => undefined)
    await flush()

    expect(authCallback).toHaveBeenCalledTimes(1)
    const built = latestInstance().options
    expect(built.token).toBe('tok-renew')

    // The promise-based callback is adapted to Ably's node-style authCallback,
    // which the SDK drives on token expiry.
    const ablyAuth = built.authCallback as (
      data: unknown,
      callback: (error: unknown, token?: string) => void,
    ) => void
    await new Promise<void>((resolve) => {
      ablyAuth({}, (error, token) => {
        expect(error).toBeNull()
        expect(token).toBe('tok-renew')
        resolve()
      })
    })
    expect(authCallback).toHaveBeenCalledTimes(2)
    client.close()
  })

  it('guards against double connect() while a connect is in flight', async () => {
    const client = createAblyClient({ authCallback: async () => 'tok' })
    void client.connect()
    void client.connect()
    await flush()

    expect(mockAbly.MockRealtime.instances.length).toBe(1)
    client.close()
  })

  it('ignores connect() while a reconnect timer is pending', async () => {
    const client = createAblyClient({
      token: 'tok',
      jitter: false,
      baseDelayMs: 1000,
    })
    client.subscribe('match:1', 'message', () => undefined)
    await flush()
    expect(mockAbly.MockRealtime.instances.length).toBe(1)

    latestInstance().connection.emit('failed')
    expect(client.state).toBe('reconnecting')

    // An explicit connect() while backoff is queued must not open a second client.
    void client.connect()
    expect(mockAbly.MockRealtime.instances.length).toBe(1)

    client.close()
  })

  it('schedules a backoff reconnect after failed and recovers', async () => {
    const client = createAblyClient({
      token: 'tok',
      jitter: false,
      baseDelayMs: 1000,
      maxDelayMs: 8000,
    })
    const handler = vi.fn()
    client.subscribe('match:1', 'message', handler)
    await flush()
    expect(client.state).toBe('connected')

    latestInstance().connection.emit('failed')
    expect(client.state).toBe('reconnecting')
    expect(latestInstance().closeLog.called).toBe(true)

    // Backoff: retryCount 0 -> delay = 1000ms. Nothing happens before that.
    await vi.advanceTimersByTimeAsync(999)
    expect(mockAbly.MockRealtime.instances.length).toBe(1)
    expect(client.state).toBe('reconnecting')

    await vi.advanceTimersByTimeAsync(1)
    expect(mockAbly.MockRealtime.instances.length).toBe(2)
    await flush()
    expect(client.state).toBe('connected')

    // Subscriptions were re-registered on the fresh client.
    channelOf('match:1', 1)!.emit('message', {
      id: 'm-2',
      name: 'message',
      data: { eventId: 'evt-2' },
    })
    expect(handler).toHaveBeenCalledTimes(1)
    client.close()
  })

  it('also reconnects after suspended and disconnected', async () => {
    const client = createAblyClient({
      token: 'tok',
      jitter: false,
      baseDelayMs: 1000,
    })
    client.subscribe('match:1', 'message', () => undefined)
    await flush()

    for (const event of ['suspended', 'disconnected'] as const) {
      latestInstance().connection.emit(event)
      expect(client.state).toBe('reconnecting')
      await vi.advanceTimersByTimeAsync(1000)
      await flush()
      expect(client.state).toBe('connected')
    }
    expect(mockAbly.MockRealtime.instances.length).toBe(3)
    client.close()
  })

  it('reconnects on offline -> online transition', async () => {
    const client = createAblyClient({ token: 'tok', jitter: false })
    client.subscribe('match:1', 'message', () => undefined)
    await flush()
    expect(client.state).toBe('connected')

    privateNet(client).handleNetworkChange(false)
    expect(client.state).toBe('offline')

    privateNet(client).handleNetworkChange(true)
    expect(client.state).toBe('connecting')
    await flush()
    expect(client.state).toBe('connected')
    expect(mockAbly.MockRealtime.instances.length).toBe(2)
    expect(mockAbly.MockRealtime.instances[0]!.closeLog.called).toBe(true)
    client.close()
  })

  it('cancels a pending reconnect while offline', async () => {
    const client = createAblyClient({
      token: 'tok',
      jitter: false,
      baseDelayMs: 1000,
    })
    client.subscribe('match:1', 'message', () => undefined)
    await flush()

    latestInstance().connection.emit('failed')
    expect(client.state).toBe('reconnecting')

    privateNet(client).handleNetworkChange(false)
    expect(client.state).toBe('offline')

    await vi.advanceTimersByTimeAsync(10000)
    expect(mockAbly.MockRealtime.instances.length).toBe(1)
    client.close()
  })

  it('reaches closed after exhausting maxRetries', async () => {
    const failing = vi.fn(async () => {
      throw new Error('no token')
    })
    const client = createAblyClient({
      authCallback: failing,
      jitter: false,
      baseDelayMs: 1000,
      maxRetries: 1,
    })
    void client.connect()
    await flush()

    // First failure arms one backoff reconnect...
    expect(client.state).toBe('reconnecting')
    await vi.advanceTimersByTimeAsync(1000)

    // ...which fails again and hits maxRetries -> closed.
    expect(client.state).toBe('closed')
    expect(mockAbly.MockRealtime.instances.length).toBe(0)
    client.close()
  })

  it('close() cancels pending reconnects and rejects further subscriptions', async () => {
    const client = createAblyClient({
      token: 'tok',
      jitter: false,
      baseDelayMs: 1000,
    })
    client.subscribe('match:1', 'message', () => undefined)
    await flush()

    latestInstance().connection.emit('failed')
    expect(client.state).toBe('reconnecting')

    client.close()
    expect(client.state).toBe('closed')

    await vi.advanceTimersByTimeAsync(10000)
    expect(mockAbly.MockRealtime.instances.length).toBe(1)

    const late = client.subscribe('match:1', 'message', () => undefined)
    const handler = vi.fn()
    channelOf('match:1')!.emit('message', {
      id: 'm-late',
      name: 'message',
      data: {},
    })
    expect(handler).not.toHaveBeenCalled()

    // close() is idempotent and late cleanup is a no-op.
    late()
    client.close()
  })
})

describe('ably-client — Subscription isolation + dedupe', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockAbly.MockRealtime.reset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('unsubscribing one entry leaves sibling handlers on the same event intact', async () => {
    const client = createAblyClient({ token: 'tok' })
    const handlerA = vi.fn()
    const handlerB = vi.fn()
    const unsubA = client.subscribe('match:1', 'message', handlerA)
    const unsubB = client.subscribe('match:1', 'message', handlerB)
    await flush()

    const listeners = channelOf('match:1')!.listeners.get('message')!
    expect(listeners.size).toBe(2)

    unsubA()
    expect(channelOf('match:1')!.listeners.get('message')!.size).toBe(1)

    channelOf('match:1')!.emit('message', {
      id: 'm-b',
      name: 'message',
      data: { eventId: 'evt-b' },
    })
    expect(handlerB).toHaveBeenCalledTimes(1)
    expect(handlerA).not.toHaveBeenCalled()

    unsubB()
    expect(channelOf('match:1')!.listeners.get('message')!.size).toBe(0)
    client.close()
  })

  it('auto-connects lazily for a subscription made before connection fires', async () => {
    const client = createAblyClient({ token: 'tok', jitter: false })
    const handler = vi.fn()
    const unsub = client.subscribe('match:1', 'typing', handler)
    expect(mockAbly.MockRealtime.instances.length).toBe(1)
    expect(client.state).toBe('connecting')

    await flush()
    expect(client.state).toBe('connected')

    channelOf('match:1')!.emit('typing', {
      id: 't-1',
      name: 'typing',
      data: { eventId: 'typing-1', payload: { isTyping: true } },
    })
    expect(handler).toHaveBeenCalledTimes(1)
    unsub()
    client.close()
  })

  it('dedupes by message id across redeliveries', async () => {
    const client = createAblyClient({ token: 'tok' })
    const handler = vi.fn()
    client.subscribe('match:1', 'message', handler)
    await flush()

    const msg = {
      id: 'm-same',
      name: 'message',
      data: { eventId: 'evt-same' },
    }
    channelOf('match:1')!.emit('message', msg)
    channelOf('match:1')!.emit('message', msg)
    expect(handler).toHaveBeenCalledTimes(1)
    client.close()
  })

  it('does not conflate distinct no-id messages that share content but differ by eventId', async () => {
    const client = createAblyClient({ token: 'tok' })
    const handler = vi.fn()
    client.subscribe('match:1', 'reaction', handler)
    await flush()

    channelOf('match:1')!.emit('reaction', {
      name: 'reaction',
      data: { eventId: 'reaction-1', payload: { emoji: 'fire' } },
    })
    channelOf('match:1')!.emit('reaction', {
      name: 'reaction',
      data: { eventId: 'reaction-2', payload: { emoji: 'fire' } },
    })
    expect(handler).toHaveBeenCalledTimes(2)
    client.close()
  })

  it('dedupes distinct no-id messages that carry the same eventId', async () => {
    const client = createAblyClient({ token: 'tok' })
    const handler = vi.fn()
    client.subscribe('match:1', 'message', handler)
    await flush()

    // A redelivered envelope without an Ably id must collapse to one delivery.
    channelOf('match:1')!.emit('message', {
      name: 'message',
      data: { eventId: 'evt-x', payload: { content: 'dup' } },
    })
    channelOf('match:1')!.emit('message', {
      name: 'message',
      data: { eventId: 'evt-x', payload: { content: 'dup' } },
    })
    expect(handler).toHaveBeenCalledTimes(1)
    client.close()
  })

  it('resubscribes after reconnect using the same per-entry handler', async () => {
    const client = createAblyClient({
      token: 'tok',
      jitter: false,
      baseDelayMs: 1000,
    })
    const messageHandler = vi.fn()
    const typingHandler = vi.fn()
    client.subscribe('match:1', 'message', messageHandler)
    client.subscribe('match:1', 'typing', typingHandler)
    await flush()

    // Sibling handlers are NOT shared with the typings of the reconnect test.
    latestInstance().connection.emit('failed')
    await vi.advanceTimersByTimeAsync(1000)
    await flush()
    expect(client.state).toBe('connected')

    const freshChannel = channelOf('match:1', 1)!
    freshChannel.emit('message', {
      id: 'm-r',
      name: 'message',
      data: { eventId: 'evt-r' },
    })
    freshChannel.emit('typing', {
      id: 't-r',
      name: 'typing',
      data: { eventId: 'typing-r' },
    })
    expect(messageHandler).toHaveBeenCalledTimes(1)
    expect(typingHandler).toHaveBeenCalledTimes(1)
    client.close()
  })
})
