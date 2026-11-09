import { useState } from 'react'
import { request, userLabel } from './api.js'

function CreateProject({ users, onCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('Planning')
  const [leadId, setLeadId] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState({ message: '', error: false })

  async function handleSubmit(event) {
    event.preventDefault()
    if (busy) return
    if (!name.trim() || !description.trim() || !leadId) {
      setFeedback({ message: 'Please provide a name, description, and Project Lead.', error: true })
      return
    }
    setBusy(true)
    setFeedback({ message: '', error: false })
    try {
      const result = await request('/api/projects', {
        method: 'POST', body: JSON.stringify({ name, description, status, project_lead_id: leadId }),
      })
      onCreated(result.project)
      setName(''); setDescription(''); setStatus('Planning'); setLeadId('')
      setFeedback({ message: result.message, error: false })
    } catch (error) {
      setFeedback({ message: error.message, error: true })
    } finally { setBusy(false) }
  }

  return (
    <section className="form-card" aria-labelledby="create-heading">
      <h2 id="create-heading">Create project</h2>
      <p className="hint">All fields are required. The lead is added as a member automatically.</p>
      {!users.length && <p role="status">No registered users yet. Open Accounts to sign up first.</p>}
      <form onSubmit={handleSubmit} noValidate>
        <fieldset disabled={busy || !users.length}>
          <label htmlFor="project-name">Name</label>
          <input id="project-name" value={name} onChange={event => setName(event.target.value)} required />
          <label htmlFor="project-description">Description</label>
          <textarea id="project-description" rows="3" value={description} onChange={event => setDescription(event.target.value)} required />
          <label htmlFor="project-status">Status</label>
          <select id="project-status" value={status} onChange={event => setStatus(event.target.value)}>
            <option>Planning</option><option>Active</option><option>Completed</option>
          </select>
          <label htmlFor="project-lead">Project Lead</label>
          <select id="project-lead" value={leadId} onChange={event => setLeadId(event.target.value)} required>
            <option value="">Select a registered user</option>
            {users.map(user => <option key={user._id} value={user._id}>{userLabel(user)}</option>)}
          </select>
          <button type="submit">{busy ? 'Creating…' : 'Create project'}</button>
        </fieldset>
      </form>
      <p className={`feedback ${feedback.error ? 'error' : 'success'}`} role="status">{feedback.message}</p>
    </section>
  )
}

export default CreateProject
