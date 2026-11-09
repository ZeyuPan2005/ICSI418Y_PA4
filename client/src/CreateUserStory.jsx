import { useState } from 'react'
import { request, userLabel } from './api.js'

const priorities = ['High', 'Medium', 'Low']

function CreateUserStory({ projects, members, users, selectedProjectId, onProjectChange, onCreated }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [assignedUserId, setAssignedUserId] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState({ message: '', error: false })
  const memberUsers = members.map(member => users.find(user => user._id === member.user_id)).filter(Boolean)

  async function handleSubmit(event) {
    event.preventDefault()
    if (busy) return
    if (!selectedProjectId || !title.trim() || !description.trim()) {
      setFeedback({ message: 'Please select a project and provide a title and description.', error: true })
      return
    }
    setBusy(true)
    setFeedback({ message: '', error: false })
    try {
      const result = await request(`/api/projects/${selectedProjectId}/stories`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          priority,
          assigned_user_id: assignedUserId || null,
        }),
      })
      onCreated(result.story)
      setTitle('')
      setDescription('')
      setPriority('Medium')
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
      <p className="hint">New stories begin in To Do. Use the backlog to move them through valid statuses.</p>
      {!projects.length ? <p role="status">Create a project before adding a story.</p> : (
        <form onSubmit={handleSubmit} noValidate>
          <fieldset disabled={busy}>
            <label htmlFor="story-project">Project</label>
            <select id="story-project" value={selectedProjectId || ''} onChange={event => onProjectChange(event.target.value)} required>
              <option value="">Select a project</option>
              {projects.map(project => <option key={project._id} value={project._id}>{project.name}</option>)}
            </select>
            <label htmlFor="story-title">Title</label>
            <input id="story-title" value={title} onChange={event => setTitle(event.target.value)} placeholder="View upcoming events" required />
            <label htmlFor="story-description">Description</label>
            <textarea id="story-description" rows="4" value={description} onChange={event => setDescription(event.target.value)} placeholder="As a student, I want to view upcoming events, so that I can decide which activities to attend." required />
            <label htmlFor="story-priority">Priority</label>
            <select id="story-priority" value={priority} onChange={event => setPriority(event.target.value)}>{priorities.map(value => <option key={value}>{value}</option>)}</select>
            <label htmlFor="story-assignee">Assigned member</label>
            <select id="story-assignee" value={assignedUserId} onChange={event => setAssignedUserId(event.target.value)} disabled={!members.length}>
              <option value="">Unassigned</option>
              {memberUsers.map(user => <option key={user._id} value={user._id}>{userLabel(user)}</option>)}
            </select>
            {!members.length && <p className="hint">Add a project member before assigning a story.</p>}
            <button type="submit">{busy ? 'Creating…' : 'Create user story'}</button>
          </fieldset>
        </form>
      )}
      <p className={`feedback ${feedback.error ? 'error' : 'success'}`} role="status">{feedback.message}</p>
    </section>
  )
}

export default CreateUserStory
