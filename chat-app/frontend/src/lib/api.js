function trimTrailingSlash(value) {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
const configuredWsBaseUrl = import.meta.env.VITE_WS_BASE_URL?.trim()

export const apiBaseUrl = configuredApiBaseUrl ? trimTrailingSlash(configuredApiBaseUrl) : ''

export function buildApiUrl(path) {
  if (!apiBaseUrl) {
    return path
  }

  return `${apiBaseUrl}${path}`
}

export function buildWebSocketUrl(token) {
  if (configuredWsBaseUrl) {
    return `${trimTrailingSlash(configuredWsBaseUrl)}/ws/chat?token=${encodeURIComponent(token)}`
  }

  if (apiBaseUrl) {
    const wsBaseUrl = apiBaseUrl.replace(/^http/i, 'ws')
    return `${wsBaseUrl}/ws/chat?token=${encodeURIComponent(token)}`
  }

  const socketProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${socketProtocol}://${window.location.host}/ws/chat?token=${encodeURIComponent(token)}`
}
