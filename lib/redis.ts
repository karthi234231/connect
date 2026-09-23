// src/lib/redis.ts
// Lazy singleton: `Redis.fromEnv()` throws at construction when env is
// absent, so construction is deferred until first use — never at module
// evaluation (which `next build` page-data collection triggers for every
// route that transitively imports redis).
import { Redis } from '@upstash/redis'

let redisSingleton: Redis | null = null

export function getRedisClient(): Redis {
  if (redisSingleton) {
    return redisSingleton
  }

  try {
    redisSingleton = Redis.fromEnv()
    return redisSingleton
  } catch (error) {
    console.error('Failed to initialize Redis client:', error)
    throw new Error(
      'Redis client initialization failed. Check UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.',
    )
  }
}

export const redis: Redis = new Proxy({} as Redis, {
  get(_t, prop, receiver) {
    return Reflect.get(getRedisClient(), prop, receiver)
  },
  set(_t, prop, value) {
    return Reflect.set(getRedisClient(), prop as string, value)
  },
})
