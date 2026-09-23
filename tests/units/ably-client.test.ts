import { describe, expect, it, beforeEach } from 'vitest'
import {
  calculateBackoffDelay,
  MessageDeduplicator,
  NetworkMonitor,
  createAblyClient,
} from '@/client/websocket/ably-client'

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
