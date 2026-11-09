import { useEffect, useState } from 'react'
import { request, userLabel } from './api.js'

const priorities = ['High', 'Medium', 'Low']
const statuses = ['To Do', 'In Progress', 'Done']

function ProjectBacklog({ project, users, onChanged }) {
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [busyId, setBusyId] = useState('')
  const [feedback, setFeedback] = useState({ message: '', error: false })

  useEffect(() => {
    const controller = new AbortController()
    request(`/api/projects/${project._id}/stories`, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) { setStories(data); setError(''); setLoading(false) }
    }).catch(fetchError => {
      if (!controller.signal.aborted) { setError(fetchError.message); setLoading(false) }
    })
    return () => controller.abort()
  }, [project._id, retry])

  async function updateStory(story, changes) {
    if (busyId) return
    setBusyId(story._id)
    setFeedback({ message: '', error: false })
    try {
      const result = await request(`/api/user-stories/${story._id}`, { method: 'PATCH', body: JSON.stringify(changes) })
      setStories(previous => previous.map(item => item._id === story._id ? result.story : item))
      setFeedback({ message: result.message, error: false })
      onChanged?.()
    } catch (updateError) {
      setFeedback({ message: updateError.message, error: true })
    } finally {
      setBusyId('')
    }
  }

  async function deleteStory(story) {
    if (busyId || !window.confirm(`Delete “${story.title}”?`)) return
    setBusyId(story._id)
    try {
      const result = await request(`/api/user-stories/${story._id}`, { method: 'DELETE' })
      setStories(previous => previous.filter(item => item._id !== story._id))
      setFeedback({ message: result.message, error: false })
      onChanged?.()
    } catch (deleteError) {
      setFeedback({ message: deleteError.message, error: true })
    } finally {
      setBusyId('')
    }
  }

  return (
    <section className="form-card backlog-section" aria-labelledby="backlog-heading">
      <div className="section-heading"><div><p className="eyebrow">Selected project</p><h2 id="backlog-heading">{project.name} backlog <span className="count">{stories.length}</span></h2></div></div>
      {loading ? <p role="status">Loading backlog…</p> : error ? <div role="alert"><p className="error">{error}</p><button onClick={() => { setError(''); setLoading(true); setRetry(value => value + 1) }}>Retry backlog</button></div> : !stories.length ? <p>No user stories yet. Add one using the form.</p> : (
        <div className="backlog-list">
          {stories.map(story => {
            const assigned = users.find(user => user._id === story.assigned_user_id)
            return <article className="story-card" key={story._id}>
              <div className="story-header"><h3>{story.title}</h3><button type="button" className="remove" disabled={busyId === story._id} onClick={() => deleteStory(story)}>Delete</button></div>
              <p className="description">{story.description}</p>
              <div className="story-controls">
                <label>Priority<select value={story.priority} disabled={busyId === story._id} onChange={event => updateStory(story, { priority: event.target.value })}>{priorities.map(value => <option key={value}>{value}</option>)}</select></label>
                <label>Status<select value={story.status} disabled={busyId === story._id} onChange={event => updateStory(story, { status: event.target.value })}>{statuses.map(value => <option key={value}>{value}</option>)}</select></label>
                <label>Assigned user<select value={story.assigned_user_id || ''} disabled={busyId === story._id} onChange={event => updateStory(story, { assigned_user_id: event.target.value || null })}><option value="">Unassigned</option>{users.map(user => <option key={user._id} value={user._id}>{userLabel(user)}</option>)}</select></label>
              </div>
              <p className="story-meta">Assigned to {assigned ? userLabel(assigned) : 'no one'}</p>
            </article>
          })}
        </div>
      )}
      <p className={`feedback ${feedback.error ? 'error' : 'success'}`} role="status">{feedback.message}</p>
    </section>
  )
}

export default ProjectBacklog
