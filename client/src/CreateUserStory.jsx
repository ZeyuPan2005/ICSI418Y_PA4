import { useState } from 'react'
import { request, userLabel } from './api.js'

const priorities = ['High', 'Medium', 'Low']
const statuses = ['To Do', 'In Progress', 'Done']

function CreateUserStory({ projects, users, selectedProjectId, onCreated }) {
  const [projectId, setProjectId] = useState(selectedProjectId || '')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [status, setStatus] = useState('To Do')
  const [assignedUserId, setAssignedUserId] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState({ message: '', error: false })

  async function handleSubmit(event) {
    event.preventDefault()
    if (busy) return
    if (!projectId || !title.trim() || !description.trim()) {
      setFeedback({ message: 'Please select a project and provide a title and description.', error: true })
      return
    }
    setBusy(true)
    setFeedback({ message: '', error: false })
    try {
      const result = await request('/api/user-stories', {
        method: 'POST',
        body: JSON.stringify({
          project_id: projectId,
          title,
          description,
          priority,
          status,
          assigned_user_id: assignedUserId || null,
        }),
      })
      onCreated(result.story)
      setTitle('')
      setDescription('')
      setPriority('Medium')
      setStatus('To Do')
      setAssignedUserId('')
      setFeedback({ message: result.message, error: false })
    } catch (error) {
      setFeedback({ message: error.message, error: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="form-card" aria-labelledby="story-create-heading">
      <h2 id="story-create-heading">Create user story</h2>
      <p className="hint">Describe the user, goal, and benefit in one sentence.</p>
      {!projects.length ? <p role="status">Create a project before adding a story.</p> : (
        <form onSubmit={handleSubmit} noValidate>
          <fieldset disabled={busy}>
            <label htmlFor="story-project">Project</label>
            <select id="story-project" value={projectId} onChange={event => setProjectId(event.target.value)} required>
              <option value="">Select a project</option>
              {projects.map(project => <option key={project._id} value={project._id}>{project.name}</option>)}
            </select>
            <label htmlFor="story-title">Title</label>
            <input id="story-title" value={title} onChange={event => setTitle(event.target.value)} placeholder="Checkout with a saved address" required />
            <label htmlFor="story-description">Description</label>
            <textarea id="story-description" rows="4" value={description} onChange={event => setDescription(event.target.value)} placeholder="As a customer, I want to save an address, so that checkout is faster." required />
            <div className="inline-fields">
              <div>
                <label htmlFor="story-priority">Priority</label>
                <select id="story-priority" value={priority} onChange={event => setPriority(event.target.value)}>{priorities.map(value => <option key={value}>{value}</option>)}</select>
              </div>
              <div>
                <label htmlFor="story-status">Status</label>
                <select id="story-status" value={status} onChange={event => setStatus(event.target.value)}>{statuses.map(value => <option key={value}>{value}</option>)}</select>
              </div>
            </div>
            <label htmlFor="story-assignee">Assigned user</label>
            <select id="story-assignee" value={assignedUserId} onChange={event => setAssignedUserId(event.target.value)}>
              <option value="">Unassigned</option>
              {users.map(user => <option key={user._id} value={user._id}>{userLabel(user)}</option>)}
            </select>
            <button type="submit">{busy ? 'Creating…' : 'Create user story'}</button>
          </fieldset>
        </form>
      )}
      <p className={`feedback ${feedback.error ? 'error' : 'success'}`} role="status">{feedback.message}</p>
    </section>
  )
}

export default CreateUserStory
