import { useEffect, useState } from 'react'
import { request, userLabel } from './api.js'

const priorities = ['High', 'Medium', 'Low']
const statuses = ['To Do', 'In Progress', 'Done']

function ProjectBacklog({ project, members, users }) {
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [editingId, setEditingId] = useState('')
  const [draft, setDraft] = useState(null)
  const [busyId, setBusyId] = useState('')
  const [feedback, setFeedback] = useState({ message: '', error: false })
  const memberUsers = members.map(member => users.find(user => user._id === member.user_id)).filter(Boolean)

  useEffect(() => {
    const controller = new AbortController()
    request(`/api/projects/${project._id}/stories`, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) { setStories(data); setError(''); setLoading(false) }
    }).catch(fetchError => {
      if (!controller.signal.aborted) { setError(fetchError.message); setLoading(false) }
    })
    return () => controller.abort()
  }, [project._id, retry])

  function beginEdit(story) {
    setEditingId(story._id)
    setDraft({
      title: story.title,
      description: story.description,
      priority: story.priority,
      status: story.status,
      assigned_user_id: story.assigned_user_id || '',
    })
    setFeedback({ message: '', error: false })
  }

  function cancelEdit() {
    setEditingId('')
    setDraft(null)
  }

  async function saveEdit(story) {
    if (!draft || busyId) return
    setBusyId(story._id)
    setFeedback({ message: '', error: false })
    try {
      const result = await request(`/api/projects/${project._id}/stories/${story._id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...draft, assigned_user_id: draft.assigned_user_id || null }),
      })
      setStories(previous => previous.map(item => item._id === story._id ? result.story : item))
      cancelEdit()
      setFeedback({ message: result.message, error: false })
    } catch (saveError) {
      setFeedback({ message: saveError.message, error: true })
    } finally {
      setBusyId('')
    }
  }

  async function deleteStory(story) {
    if (busyId || !window.confirm(`Delete “${story.title}”?`)) return
    setBusyId(story._id)
    setFeedback({ message: '', error: false })
    try {
      const result = await request(`/api/projects/${project._id}/stories/${story._id}`, { method: 'DELETE' })
      setStories(previous => previous.filter(item => item._id !== story._id))
      if (editingId === story._id) cancelEdit()
      setFeedback({ message: result.message, error: false })
    } catch (deleteError) {
      setFeedback({ message: deleteError.message, error: true })
    } finally {
      setBusyId('')
    }
  }

  return (
    <section className="form-card backlog-section" aria-labelledby="backlog-heading">
      <div className="section-heading"><div><p className="eyebrow">Selected project</p><h2 id="backlog-heading">{project.name} backlog <span className="count">{stories.length}</span></h2></div></div>
      {loading ? <p role="status">Loading backlog…</p> : error ? <div role="alert"><p className="error">{error}</p><button onClick={() => { setLoading(true); setRetry(value => value + 1) }}>Retry backlog</button></div> : !stories.length ? <p>No user stories yet. Add one using the form.</p> : (
        <div className="backlog-list">
          {stories.map(story => {
            const assigned = users.find(user => user._id === story.assigned_user_id)
            const isEditing = editingId === story._id && draft
            return <article className="story-card" key={story._id}>
              {isEditing ? (
                <form onSubmit={event => { event.preventDefault(); saveEdit(story) }}>
                  <label htmlFor={`${story._id}-title`}>Title</label>
                  <input id={`${story._id}-title`} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} required />
                  <label htmlFor={`${story._id}-description`}>Description</label>
                  <textarea id={`${story._id}-description`} rows="4" value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} required />
                  <div className="story-controls">
                    <label>Priority<select value={draft.priority} onChange={event => setDraft({ ...draft, priority: event.target.value })}>{priorities.map(value => <option key={value}>{value}</option>)}</select></label>
                    <label>Status<select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value })}>{statuses.map(value => <option key={value}>{value}</option>)}</select></label>
                    <label>Assigned member<select value={draft.assigned_user_id} onChange={event => setDraft({ ...draft, assigned_user_id: event.target.value })}><option value="">Unassigned</option>{memberUsers.map(user => <option key={user._id} value={user._id}>{userLabel(user)}</option>)}</select></label>
                  </div>
                  <div className="button-row"><button type="submit" disabled={busyId === story._id}>{busyId === story._id ? 'Saving…' : 'Save'}</button><button type="button" className="secondary" onClick={cancelEdit} disabled={busyId === story._id}>Cancel</button></div>
                </form>
              ) : (
                <>
                  <div className="story-header"><h3>{story.title}</h3><div className="button-row"><button type="button" onClick={() => beginEdit(story)}>Edit</button><button type="button" className="remove" disabled={busyId === story._id} onClick={() => deleteStory(story)}>Delete</button></div></div>
                  <p className="description">{story.description}</p>
                  <div className="story-summary"><span className="status">{story.status}</span><span className="status">{story.priority}</span></div>
                  <p className="story-meta">Assigned member: {assigned ? userLabel(assigned) : 'Unassigned'}</p>
                </>
              )}
            </article>
          })}
        </div>
      )}
      <p className={`feedback ${feedback.error ? 'error' : 'success'}`} role="status">{feedback.message}</p>
    </section>
  )
}

export default ProjectBacklog
