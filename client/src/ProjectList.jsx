import { userLabel } from './api.js'

function ProjectList({ projects, users, selectedId, onSelect }) {
  return (
    <section className="form-card" aria-labelledby="list-heading">
      <h2 id="list-heading">Projects <span className="count">{projects.length}</span></h2>
      {!projects.length && <p>No projects yet. Create your first project using the form.</p>}
      <div className="project-list">
        {projects.map(project => (
          <article key={project._id} className={`project-card ${selectedId === project._id ? 'selected' : ''}`}>
            <div className="project-title"><h3>{project.name}</h3><span className={`status ${project.status.toLowerCase()}`}>{project.status}</span></div>
            <p className="description">{project.description}</p>
            <p><strong>Project Lead:</strong> {userLabel(users.find(user => user._id === project.project_lead_id))}</p>
            <button type="button" aria-pressed={selectedId === project._id} onClick={() => onSelect(project._id)}>
              {selectedId === project._id ? 'Members selected' : 'Manage members'}
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

export default ProjectList
