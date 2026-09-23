// src/services/linkedin/client.ts
// HTTP transport for the LinkedIn provider. Holds no raw secrets: it owns a
// base URL and an access-token provider callback; tokens are fetched per
// request. Timeouts + bounded retries; 401 maps to revoked, transient
// failures map to unavailable — response schema validation lives in profile.ts.
import {
  InvalidProviderResponseError,
  ProviderRevokedError,
  ProviderUnavailableError,
} from './errors'

export interface AccessTokenProvider {
  getAccessToken(): Promise<string | null>
}

export interface LinkedInClientOptions {
  baseUrl: string
  tokenProvider: AccessTokenProvider
  timeoutMs?: number
  maxRetries?: number
}

const DEFAULT_TIMEOUT_MS = 8_000
const DEFAULT_MAX_RETRIES = 2

export class LinkedInApiClient {
  private readonly baseUrl: string
  private readonly tokenProvider: AccessTokenProvider
  private readonly timeoutMs: number
  private readonly maxRetries: number

  constructor(options: LinkedInClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.tokenProvider = options.tokenProvider
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
  }

  async get<T = unknown>(path: string): Promise<T> {
    const url = new URL(path, this.baseUrl)
    const token = await this.tokenProvider.getAccessToken()
    if (!token) {
      // A missing provider_token means there is no live grant to call the API
      // with — sync must classify this as provider_revoked (re-auth needed),
      // not a transient failure that retries forever.
      throw new ProviderRevokedError(
        'No LinkedIn access token (grant missing or revoked)',
        { context: { path } },
      )
    }

    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })

    if (response.status === 401) {
      throw new ProviderRevokedError('LinkedIn access token was rejected', {
        context: { path, status: response.status },
      })
    }
    if (!response.ok) {
      throw new ProviderUnavailableError(
        `LinkedIn API returned HTTP ${response.status}`,
        { context: { path, status: response.status } },
      )
    }

    const text = await response.text()
    try {
      return JSON.parse(text) as T
    } catch (cause) {
      throw new InvalidProviderResponseError('LinkedIn API returned non-JSON', {
        cause,
        context: { path },
      })
    }
  }

  private async fetchWithRetry(url: URL, init: RequestInit): Promise<Response> {
    let lastError: unknown
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) await delay(backoffMs(attempt))
      let response: Response
      try {
        response = await this.fetchWithTimeout(url, init)
      } catch (err) {
        if (isRetryableTransportError(err)) {
          lastError = new ProviderUnavailableError(
            'LinkedIn API request failed',
            { cause: err, context: { url: url.toString() } },
          )
          continue
        }
        throw err
      }
      if (response.status === 429 || response.status >= 500) {
        lastError = new ProviderUnavailableError(
          `LinkedIn API transient error (HTTP ${response.status})`,
          { context: { path: url.pathname, status: response.status } },
        )
        continue
      }
      return response
    }
    throw (
      lastError ?? new ProviderUnavailableError('LinkedIn API request failed')
    )
  }

  private async fetchWithTimeout(
    url: URL,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      return await fetch(url, { ...init, signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }
  }
}

function isRetryableTransportError(err: unknown): boolean {
  if (err instanceof TypeError) return true // fetch network failure
  if (typeof err === 'object' && err !== null && 'name' in err) {
    const name = (err as { name?: unknown }).name
    return name === 'AbortError' || name === 'TimeoutError'
  }
  return false
}

function backoffMs(attempt: number): number {
  return Math.min(250 * 2 ** (attempt - 1), 2_000)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
