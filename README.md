# ICSI418Y_PA4

Programming Assignment 4 for ICSI 418Y Software Engineering. This repository extends the working PA3 application with validated user stories and project backlogs.

User stories describe planned features in the `As a [type of user], I want [goal], so that [benefit].` format. This application stores and manages the stories; it does not implement their described features. Story statuses (`To Do`, `In Progress`, `Done`) are separate from project statuses (`Planning`, `Active`, `Completed`). Done stories remain in the backlog.

## Features

- Register new users and log in with existing accounts.
- Create projects with a name, description, status, and registered project lead.
- View, add, and remove project members while protecting project leads.
- Create user stories with a title, user-story description, and priority.
- Start every new story in `To Do`, then edit title, description, priority, status, or assignment.
- Assign stories only to members of the same project, or leave them unassigned.
- Prevent member removal while that member has assigned stories in the project.
- View and manage each project's project-scoped backlog.

## Technologies

- Frontend: React, JavaScript, Vite, CSS
- Backend: Node.js, Express
- Database: MongoDB Atlas with the native MongoDB Node.js driver

## Project Structure

```text
client/src/
  App.jsx                 Main page and shared state
  Signup.jsx, Login.jsx   Account forms from PA2
  CreateProject.jsx       Project creation form
  ProjectList.jsx         Project list
  ProjectMembers.jsx      Member management
  CreateUserStory.jsx     Story creation form
  ProjectBacklog.jsx      Project-scoped backlog and editing
  api.js                  HTTP requests

server/
  server.js               Database connection and startup
  app.js                  Express setup and account routes
  projects.js             Project, membership, and story API
  seed-demo.js            Guarded PA4 demonstration data setup
  test/                   Backend tests
```

## Getting Started

Install Node.js and have a MongoDB Atlas database ready. From the repository directory, install dependencies in both folders:

```bash
cd server
npm install
cd ../client
npm install
```

Create `server/.env` and set your Atlas connection string. Use `MONGO_DB_NAME=pa4_dev` for PA4 development:

```dotenv
MONGO_URI=your_mongodb_connection_string
MONGO_DB_NAME=pa4_dev
```

Keep `.env` private. Make sure your current IP address is allowed in Atlas Network Access.

Start the backend in one terminal from `server/`:

```bash
npm start
```

Start the frontend in a second terminal from `client/`:

```bash
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`. The backend API runs at `http://localhost:9000`.

## Database and business rules

The app uses `MONGO_DB_NAME` when set and otherwise preserves the PA3 `pa2` database for compatibility. PA4 adds a `UserStories` collection:

- `users`: registered users from PA2.
- `Projects`: projects with `name`, `description`, `status`, and `project_lead_id`.
- `ProjectMemberships`: relationships stored as `project_id` and `user_id`.
- `UserStories`: stories stored with `project_id`, `title`, `description`, `priority`, `status`, and nullable `assigned_user_id`.

All relationship fields are MongoDB ObjectIds. Every story belongs to one project and its `project_id` cannot change. A story can be assigned only to a member of its own project, including the project lead. A member with assigned stories cannot be removed until those stories are reassigned, unassigned, or deleted. New stories always begin in `To Do`. A unique index prevents duplicate project/user pairs, and project creation uses a transaction to save the project and lead membership together.

## API endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | `/signup` | Register a user |
| POST | `/login` | Check user credentials |
| GET | `/api/users` | Get registered users |
| POST | `/api/projects` | Create a project |
| GET | `/api/projects` | List projects |
| GET | `/api/projects/:projectId/members` | List project members |
| POST | `/api/projects/:projectId/members` | Add a member |
| DELETE | `/api/projects/:projectId/members/:userId` | Remove a member when allowed |
| GET | `/api/projects/:projectId/stories` | List a project's backlog |
| POST | `/api/projects/:projectId/stories` | Create a story in `To Do` |
| PUT | `/api/projects/:projectId/stories/:storyId` | Edit all story fields except `project_id` |
| DELETE | `/api/projects/:projectId/stories/:storyId` | Delete a story from that project |

## Testing

In `server/`, run `npm test` for local API tests. Set `MONGO_DB_NAME=pa4_dev` before running `npm run test:integration`. The integration suite refuses other databases, creates temporary records, and cleans up only those records at the end.

In `client/`, run `npm run lint` and `npm run build`.

## Demo data

The repeatable demo seed uses the isolated `pa4_dev` database only. It creates or reuses the accounts `ZeyuPan2005`, `LinxuanSui2004`, and `FangruiLiu2004`, two projects, their memberships, and five user stories. Existing account passwords are preserved. New accounts use the local-only `PA4_DEMO_PASSWORD` value.

Set these variables in the ignored `server/.env` file:

```dotenv
MONGO_DB_NAME=pa4_dev
PA4_DEMO_PASSWORD=your_local_demo_password
```

Then run:

```bash
cd server
npm run seed:demo
```

The seed refuses to run when the database is unspecified or named `pa2`. It never deletes unrelated records, and it prints only created/reused usernames, projects, and story titles. The demonstration projects are `Campus Event Platform` and `Study Planner`. The stories cover High, Medium, and Low priorities, To Do, In Progress, and Done statuses, assigned members, and an unassigned story.

## Manual verification (before recording)

1. Open the React client, select `Campus Event Platform`, and check that its three stories (including the Done story) are visible.
2. Create a new story and confirm that it starts in `To Do`. Try the assignee list: only members of the selected project should appear.
3. Edit a story's title, description, priority, status, and assignee. Test **Cancel** (no saved change) and **Save** (persistent change).
4. Try to remove a non-lead member who has an assigned story, including a Done story. Removal must fail until that project's stories are reassigned, unassigned, or deleted.
5. Switch to `Study Planner`; confirm its backlog is separate. Test deletion confirmation and refresh the browser to verify persistence.
6. Inspect the `UserStories` collection in Atlas and show the `ObjectId` relationships. Check that PA3 signup, login, project creation, and membership operations still work.

The demo seed is **non-destructive** and does not reset edited or deleted demonstration records to their original values when rerun.

## Note

As in PA2, login checks credentials but does not create a user session. This is a course assignment rather than a production authentication system.
