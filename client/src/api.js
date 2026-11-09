const API_BASE = 'http://localhost:9000'

export async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('Could not connect to the server. Check that it is running on port 9000.', { cause: error })
  }
  let data
  try { data = await response.json() } catch {
    throw new Error('The server returned an unreadable response. Please try again.')
  }
  if (!response.ok) throw new Error(data.message || 'The request failed. Please try again.')
  return data
}

export function userLabel(user) {
  if (!user) return 'Unknown user'
  const name = [user.f_name, user.l_name].filter(Boolean).join(' ')
  return name ? `${name} (${user.username})` : user.username
}
