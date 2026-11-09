import { useEffect, useState } from 'react'
import Signup from './Signup.jsx'
import Login from './Login.jsx'
import CreateProject from './CreateProject.jsx'
import ProjectList from './ProjectList.jsx'
import ProjectMembers from './ProjectMembers.jsx'
import { request } from './api.js'
import './App.css'

function App() {
  const [page, setPage] = useState('projects')
  const [users, setUsers] = useState([])
  const [projects, setProjects] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const selected = projects.find(project => project._id === selectedId) || projects[0]

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      request('/api/users', { signal: controller.signal }),
      request('/api/projects', { signal: controller.signal }),
    ]).then(([nextUsers, nextProjects]) => {
      if (!controller.signal.aborted) {
        setUsers(nextUsers); setProjects(nextProjects); setError(''); setLoading(false)
      }
    }).catch(error => {
      if (!controller.signal.aborted) { setError(error.message); setLoading(false) }
    })
    return () => controller.abort()
  }, [revision])

  function refresh() {
    setLoading(true)
    setRevision(value => value + 1)
  }

  function onCreated(project) {
    // The committed API response immediately updates the list and selects the new project.
    setProjects(previous => [...previous, project])
    setSelectedId(project._id)
  }

  return (
    <main>
      <header>
        <p className="eyebrow">ICSI 418Y · Programming Assignment 3</p>
        <h1>Projects &amp; memberships</h1>
        <p>Create projects, choose leads, and bring your team together.</p>
      </header>
      <nav aria-label="Main navigation">
        <button aria-current={page === 'projects' ? 'page' : undefined} onClick={() => setPage('projects')}>Projects</button>
        <button aria-current={page === 'accounts' ? 'page' : undefined} onClick={() => setPage('accounts')}>Accounts · Signup &amp; Login</button>
      </nav>
      {page === 'accounts' ? (
        <div className="forms"><Signup onRegistered={refresh} /><Login /></div>
      ) : (
        <>
          <div className="toolbar"><p>{users.length} registered users · {projects.length} projects</p><button onClick={refresh} disabled={loading}>Refresh data</button></div>
          {loading ? <p role="status">Loading users and projects…</p> : error ? (
            <div className="form-card" role="alert"><p className="error">{error}</p><button onClick={refresh}>Retry</button></div>
          ) : (
            <>
              <div className="forms project-grid">
                <CreateProject users={users} onCreated={onCreated} />
                <ProjectList projects={projects} users={users} selectedId={selected?._id} onSelect={setSelectedId} />
              </div>
              <section className="form-card membership-section" aria-labelledby="members-heading">
                <h2 id="members-heading">Manage memberships</h2>
                {!projects.length ? <p>Create a project to manage its members.</p> : (
                  <>
                    <label htmlFor="selected-project">Select a project</label>
                    <select id="selected-project" value={selected._id} onChange={event => setSelectedId(event.target.value)}>
                      {projects.map(project => <option key={project._id} value={project._id}>{project.name}</option>)}
                    </select>
                    <ProjectMembers key={selected._id} project={selected} users={users} />
                  </>
                )}
              </section>
            </>
          )}
        </>
      )}
    </main>
  )
}

export default App
