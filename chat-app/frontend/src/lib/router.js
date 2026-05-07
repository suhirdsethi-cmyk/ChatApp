export function getPathname() {
  const path = window.location.pathname || '/'
  if (path === '/index.html') {
    return '/'
  }
  return path
}

export function navigateTo(path) {
  if (window.location.pathname === path) {
    return
  }

  window.history.pushState({}, '', path)
}
