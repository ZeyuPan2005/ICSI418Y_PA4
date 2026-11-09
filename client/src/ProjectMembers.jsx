import { useEffect, useState } from 'react'
import { request, userLabel } from './api.js'

// Keyed by project ID in App: switching projects resets state and cancels stale GETs.
function ProjectMembers({ project, users }) {
  const [members, setMembers] = useState([])
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState({ message: '', error: false })
  const path = `/api/projects/${project._id}/members`

  useEffect(() => {
    const controller = new AbortController()
    request(path, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) { setMembers(data); setLoadError(''); setLoading(false) }
    }).catch(error => {
      if (!controller.signal.aborted) { setLoadError(error.message); setLoading(false) }
    })
    return () => controller.abort()
  }, [path, revision])

  function refresh() {
    setLoading(true)
    setRevision(value => value + 1)
  }

  async function changeMember(method, targetId) {
    if (busy) return
    if (!targetId) {
      setFeedback({ message: 'Please select a registered user.', error: true })
      return
    }
    setBusy(true)
    setFeedback({ message: '', error: false })
    try {
      const result = await request(method === 'DELETE' ? `${path}/${targetId}` : path, {
        method, ...(method === 'POST' ? { body: JSON.stringify({ user_id: targetId }) } : {}),
      })
      setFeedback({ message: result.message, error: false })
      refresh()
    } catch (error) {
      setFeedback({ message: error.message, error: true })
    } finally { setBusy(false) }
  }

  return (
    <div aria-busy={loading || busy}>
      <h3>Members of {project.name}</h3>
      {loading ? <p role="status">Loading members…</p> : loadError ? (
        <div role="alert"><p className="error">{loadError}</p><button onClick={refresh}>Retry member list</button></div>
      ) : members.length ? (
        <ul className="member-list">
          {members.map(member => (
            <li key={member._id}>
              <span>{userLabel(users.find(user => user._id === member.user_id))}</span>
              {member.user_id === project.project_lead_id
                ? <span className="lead-badge">Project Lead · cannot remove</span>
                : <button type="button" className="remove" disabled={busy} aria-label={`Remove ${userLabel(users.find(user => user._id === member.user_id))}`} onClick={() => changeMember('DELETE', member.user_id)}>Remove</button>}
            </li>
          ))}
        </ul>
      ) : <p>No members found.</p>}
      <form onSubmit={event => { event.preventDefault(); changeMember('POST', userId) }}>
        <label htmlFor="member-user">Add a registered user</label>
        <select id="member-user" value={userId} onChange={event => setUserId(event.target.value)} disabled={busy || loading || !!loadError}>
          <option value="">Select a registered user</option>
          {/* Existing members stay selectable so the duplicate rule can be demonstrated. */}
          {users.map(user => <option key={user._id} value={user._id}>{userLabel(user)}</option>)}
        </select>
        <button type="submit" disabled={busy || loading || !!loadError || !users.length}>{busy ? 'Saving…' : 'Add member'}</button>
      </form>
      <p className="hint">Each user may join several projects. Adding the same user twice to this project will be rejected.</p>
      <p className={`feedback ${feedback.error ? 'error' : 'success'}`} role="status">{feedback.message}</p>
    </div>
  )
}

export default ProjectMembers
