// @vitest-environment jsdom
// tests/units/use-chat-connection.test.ts
// Regression + contract coverage for hooks/use-chat-connection.ts with a
// vi.mock'd `ably` (jsdom), plus pure tests for the typing-expiry controller.

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useChatConnection } from '@/hooks/use-chat-connection'
import { createTypingController } from '@/lib/chat/typing-controller'

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
    published: Array<{ event: string; data: unknown }> = []

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

    publish(event: string, data: unknown) {
      this.published.push({ event, data })
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

const actions = vi.hoisted(() => ({
  getAblyTokenAction: vi.fn(async () => ({ token: 'tok-123', clientId: 'me' })),
  publishTypingAction: vi.fn(async () => undefined),
}))

vi.mock('ably', () => ({ default: { Realtime: mockAbly.MockRealtime } }))
vi.mock('@/app/actions/chat', () => ({
  getAblyTokenAction: actions.getAblyTokenAction,
  publishTypingAction: actions.publishTypingAction,
}))

const MATCH_ID = 'm1'
const CHANNEL = `match:${MATCH_ID}`

const envelope = (
  type: 'typing' | 'message' | 'reaction' | 'receipt',
  actorId: string,
  payload: unknown,
  eventId: string,
) => ({
  eventId,
  type,
  actorId,
  conversationId: MATCH_ID,
  createdAt: new Date().toISOString(),
  version: 1,
  payload,
})

const typingEnv = (
  actorId: string,
  isTyping: boolean,
  eventId = `t-${Math.random()}`,
) => envelope('typing', actorId, { isTyping }, eventId)

const messageEnv = (
  actorId: string,
  id = `msg-${Math.random()}`,
  eventId = `m-${Math.random()}`,
) =>
  envelope(
    'message',
    actorId,
    {
      matchId: MATCH_ID,
      id,
      senderId: actorId,
      content: 'hello',
      createdAt: new Date().toISOString(),
    },
    eventId,
  )

const reactionEnv = (actorId: string, eventId = `r-${Math.random()}`) =>
  envelope(
    'reaction',
    actorId,
    { messageId: 'm-1', userId: actorId, emoji: 'flame', active: true },
    eventId,
  )

const receiptEnv = (actorId: string, eventId = `rc-${Math.random()}`) =>
  envelope(
    'receipt',
    actorId,
    {
      matchId: MATCH_ID,
      readerId: actorId,
      readAt: new Date().toISOString(),
    },
    eventId,
  )

const latest = () =>
  mockAbly.MockRealtime.instances[mockAbly.MockRealtime.instances.length - 1]!
const channelOf = (index = 0) =>
  mockAbly.MockRealtime.instances[index]!.channels.get(CHANNEL)
const nextId = () => `ab-${Math.random().toString(36).slice(2)}`

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(20)
    await Promise.resolve()
  })
}

function emit(event: string, data: unknown, index = 0): void {
  channelOf(index).emit(event, { id: nextId(), name: event, data })
}

beforeEach(() => {
  vi.useFakeTimers()
  mockAbly.MockRealtime.reset()
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value: true,
  })
  actions.getAblyTokenAction.mockReset()
  actions.publishTypingAction.mockReset()
  actions.getAblyTokenAction.mockImplementation(async () => ({
    token: 'tok-123',
    clientId: 'me',
  }))
})

afterEach(() => {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value: true,
  })
  vi.useRealTimers()
})

describe('useChatConnection — engine lifecycle', () => {
  it('authenticates via authCallback and reaches online', async () => {
    const { result, unmount } = renderHook(() => useChatConnection(MATCH_ID))
    expect(result.current.state).toBe('connecting')
    await flush()
    expect(result.current.state).toBe('online')
    expect(result.current.networkOnline).toBe(true)
    expect(actions.getAblyTokenAction).toHaveBeenCalledWith({ matchId: MATCH_ID })
    expect(mockAbly.MockRealtime.instances.length).toBe(1)

    const built = latest().options
    expect(built.autoConnect).toBe(true)
    expect(built.token).toBe('tok-123')
    expect(typeof built.authCallback).toBe('function')

    // Ably's node-style authCallback must renew the short-lived token.
    const ablyAuth = built.authCallback as (
      data: unknown,
      callback: (error: unknown, token?: string) => void,
    ) => void
    const renewed = await new Promise<string>((resolve, reject) => {
      ablyAuth({}, (error, token) =>
        error ? reject(error) : resolve(token ?? ''),
      )
    })
    expect(renewed).toBe('tok-123')
    expect(actions.getAblyTokenAction.mock.calls.length).toBe(2)
    unmount()
  })

  it('fires onReconnect when the channel returns to connected after a drop', async () => {
    const onReconnect = vi.fn()
    const { result, unmount } = renderHook(() =>
      useChatConnection(MATCH_ID, { myId: 'me', onReconnect }),
    )
    await flush()
    expect(result.current.state).toBe('online')

    act(() => latest().connection.emit('failed'))
    expect(result.current.state).toBe('reconnecting')
    expect(onReconnect).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    expect(result.current.state).toBe('online')
    expect(onReconnect).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('retries the full handshake after the engine exhausts its retry budget', async () => {
    let authCalls = 0
    actions.getAblyTokenAction.mockImplementation(async () => {
      authCalls += 1
      if (authCalls <= 11) throw new Error('auth down')
      return { token: 'tok-ok', clientId: 'me' }
    })
    const { result, unmount } = renderHook(() =>
      useChatConnection(MATCH_ID, { myId: 'me' }),
    )
    await flush()
    // Engine burned through its internal retries → `closed` → the hook maps
    // that to `connecting` while it schedules its own handshake retry.
    expect(result.current.state).toBe('connecting')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300000)
    })
    expect(authCalls).toBeGreaterThanOrEqual(12)
    expect(result.current.state).toBe('online')
    unmount()
  })

  it('survives a StrictMode-style mount → cleanup → re-mount with the same matchId', async () => {
    const onMessage = vi.fn()
    const first = renderHook(() =>
      useChatConnection(MATCH_ID, { myId: 'me', onMessage }),
    )
    await flush()
    expect(mockAbly.MockRealtime.instances.length).toBe(1)
    expect(first.result.current.state).toBe('online')

    first.unmount()
    expect(mockAbly.MockRealtime.instances[0]!.closeLog.called).toBe(true)

    const second = renderHook(() =>
      useChatConnection(MATCH_ID, { myId: 'me', onMessage }),
    )
    await flush()
    expect(mockAbly.MockRealtime.instances.length).toBe(2)
    expect(second.result.current.state).toBe('online')

    act(() => emit('message', messageEnv('peer'), 1))
    expect(onMessage).toHaveBeenCalledTimes(1)
    second.unmount()
  })

  it('unsubscribes all events and closes the engine on cleanup', async () => {
    const onMessage = vi.fn()
    const { unmount } = renderHook(() =>
      useChatConnection(MATCH_ID, { myId: 'me', onMessage }),
    )
    await flush()
    const channel = channelOf()
    for (const event of ['typing', 'reaction', 'message', 'receipt']) {
      expect(channel.listeners.get(event)?.size ?? 0).toBeGreaterThan(0)
    }

    unmount()
    expect(latest().closeLog.called).toBe(true)
    for (const event of ['typing', 'reaction', 'message', 'receipt']) {
      expect(channel.listeners.get(event)?.size ?? 0).toBe(0)
    }

    act(() => emit('message', messageEnv('peer')))
    expect(onMessage).not.toHaveBeenCalled()
  })

  it('reflects networkOnline from the engine network status', async () => {
    const { result, unmount } = renderHook(() => useChatConnection(MATCH_ID))
    await flush()
    expect(result.current.networkOnline).toBe(true)

    // Drive the engine's NetworkMonitor through the real browser signal path.
    act(() => {
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        value: false,
      })
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current.networkOnline).toBe(false)
    expect(result.current.state).toBe('reconnecting')

    act(() => {
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        value: true,
      })
      window.dispatchEvent(new Event('online'))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20)
    })
    expect(result.current.networkOnline).toBe(true)
    expect(result.current.state).toBe('online')
    unmount()
  })
})

describe('useChatConnection — inbound events', () => {
  it('delivers peer payloads via callbacks and filters own echoes on all four events', async () => {
    const onMessage = vi.fn()
    const onReaction = vi.fn()
    const onReceipt = vi.fn()
    const { result, unmount } = renderHook(() =>
      useChatConnection(MATCH_ID, { myId: 'me', onMessage, onReaction, onReceipt }),
    )
    await flush()
    expect(result.current.state).toBe('online')

    // Own echoes are ignored for every envelope type.
    act(() => emit('typing', typingEnv('me', true)))
    expect(result.current.isPeerTyping).toBe(false)
    act(() => emit('message', messageEnv('me')))
    act(() => emit('reaction', reactionEnv('me')))
    act(() => emit('receipt', receiptEnv('me')))
    expect(onMessage).not.toHaveBeenCalled()
    expect(onReaction).not.toHaveBeenCalled()
    expect(onReceipt).not.toHaveBeenCalled()

    // Peer envelopes are delivered to the configured callbacks.
    act(() => emit('typing', typingEnv('peer', true)))
    expect(result.current.isPeerTyping).toBe(true)

    const message = messageEnv('peer')
    act(() => emit('message', message))
    expect(onMessage).toHaveBeenCalledWith(message.payload)

    const reaction = reactionEnv('peer')
    act(() => emit('reaction', reaction))
    expect(onReaction).toHaveBeenCalledWith(reaction.payload)

    const receipt = receiptEnv('peer')
    act(() => emit('receipt', receipt))
    expect(onReceipt).toHaveBeenCalledWith(receipt.payload)
    unmount()
  })

  it('clears isPeerTyping when a peer message arrives', async () => {
    const onMessage = vi.fn()
    const { result, unmount } = renderHook(() =>
      useChatConnection(MATCH_ID, { myId: 'me', onMessage }),
    )
    await flush()
    act(() => emit('typing', typingEnv('peer', true)))
    expect(result.current.isPeerTyping).toBe(true)

    act(() => emit('message', messageEnv('peer')))
    expect(result.current.isPeerTyping).toBe(false)
    expect(onMessage).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('auto-expires isPeerTyping after the typing timeout', async () => {
    const { result, unmount } = renderHook(() =>
      useChatConnection(MATCH_ID, { myId: 'me' }),
    )
    await flush()

    act(() => emit('typing', typingEnv('peer', true)))
    expect(result.current.isPeerTyping).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    expect(result.current.isPeerTyping).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(result.current.isPeerTyping).toBe(false)
    unmount()
  })
})

describe('useChatConnection — sendTyping', () => {
  it('publishes a typed envelope via the engine when connected', async () => {
    const { result, unmount } = renderHook(() =>
      useChatConnection(MATCH_ID, { myId: 'me' }),
    )
    await flush()
    act(() => result.current.sendTyping?.(true))

    const published = channelOf().published[0]!
    expect(published.event).toBe('typing')
    expect(published.data).toMatchObject({
      type: 'typing',
      actorId: 'me',
      conversationId: MATCH_ID,
      version: 1,
      payload: { isTyping: true },
    })
    expect(actions.publishTypingAction).not.toHaveBeenCalled()
    unmount()
  })

  it('falls back to publishTypingAction when the engine cannot publish', async () => {
    const { result, unmount } = renderHook(() =>
      useChatConnection(MATCH_ID, { myId: 'me' }),
    )
    // Engine exists but is still idle/connecting → fall back to the action.
    act(() => result.current.sendTyping?.(true))
    expect(actions.publishTypingAction).toHaveBeenCalledWith({
      matchId: MATCH_ID,
      isTyping: true,
    })

    actions.publishTypingAction.mockClear()
    unmount()
    // After teardown there is no engine at all → fire-and-forget action.
    act(() => result.current.sendTyping?.(false))
    expect(actions.publishTypingAction).toHaveBeenCalledWith({
      matchId: MATCH_ID,
      isTyping: false,
    })
  })

  it('falls back to publishTypingAction when myId is not supplied', async () => {
    const { result, unmount } = renderHook(() => useChatConnection(MATCH_ID))
    await flush()
    expect(result.current.state).toBe('online')

    act(() => result.current.sendTyping?.(true))
    expect(actions.publishTypingAction).toHaveBeenCalledWith({
      matchId: MATCH_ID,
      isTyping: true,
    })
    expect(channelOf().published.length).toBe(0)
    unmount()
  })
})

describe('createTypingController — pure typing expiry', () => {
  it('applies presence and expires after the timeout', () => {
    const controller = createTypingController({ timeoutMs: 4000 })
    expect(controller.update(true, 1000)).toBe(true)
    expect(controller.isVisible()).toBe(true)
    expect(controller.tick(4999)).toBe(true)
    expect(controller.tick(5000)).toBe(false)
    expect(controller.isVisible()).toBe(false)
  })

  it('drops presence on update(false)', () => {
    const controller = createTypingController()
    controller.update(true, 0)
    expect(controller.update(false, 100)).toBe(false)
    expect(controller.isVisible()).toBe(false)
  })

  it('reset clears state (inbound message / matchId change)', () => {
    const controller = createTypingController()
    controller.update(true, 0)
    expect(controller.reset()).toBe(false)
    expect(controller.isVisible()).toBe(false)
    expect(controller.tick(100000)).toBe(false)
  })

  it('a refresh extends the expiry window', () => {
    const controller = createTypingController({ timeoutMs: 4000 })
    controller.update(true, 0)
    controller.update(true, 3000)
    expect(controller.tick(6500)).toBe(true)
    expect(controller.tick(7001)).toBe(false)
  })

  it('defaults to a 4000ms expiry', () => {
    const controller = createTypingController()
    controller.update(true, 0)
    expect(controller.tick(3999)).toBe(true)
    expect(controller.tick(4000)).toBe(false)
  })
})