# ICSI418Y_PA4

Programming Assignment 4 for ICSI 418Y Software Engineering. This repository extends the working PA3 application with user stories and project backlogs.

PA4 adds validated user stories and a project-specific backlog while retaining the PA3 account, project, and membership workflows.

## Features

- Register new users and log in with existing accounts.
- Create projects with a name, description, status, and registered project lead.
- View projects and their leads by name.
- View, add, and remove project members.
- Add the same user to different projects, but prevent duplicate membership in one project.
- Automatically add project leads as members and prevent their removal.
- Create user stories with a title, user-story description, priority, status, and optional assignee.
- View each project's backlog and update story priority, status, assignment, or deletion.
- Display clear feedback for invalid operations.

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
  api.js                  HTTP requests

server/
  server.js               Database connection and startup
  app.js                  Express setup and account routes
  projects.js             Project and membership API
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

Create `server/.env` and set your Atlas connection string. You can isolate PA4 data by choosing a separate database name:

```dotenv
MONGO_URI=your_mongodb_connection_string
MONGO_DB_NAME=pa4_dev
```

Keep `.env` private. Make sure your current IP address is allowed in Atlas Network Access.

Start the backend in one terminal (from `server/`):

```bash
npm start
```

Start the frontend in a second terminal (from `client/`):

```bash
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`. The backend API runs at `http://localhost:9000`.

## Database

The app uses `MONGO_DB_NAME` when set and otherwise preserves the PA3 `pa2` database for compatibility. PA4 adds a `UserStories` collection:

- `users`: registered users from PA2.
- `Projects`: projects with `name`, `description`, `status`, and `project_lead_id`.
- `ProjectMemberships`: relationships stored as `project_id` and `user_id`.
- `UserStories`: stories stored with `project_id`, `title`, `description`, `priority`, `status`, and nullable `assigned_user_id`.

The relationship fields are MongoDB ObjectIds. A user may join multiple projects, and a project may contain multiple users. The project lead is also a member. A unique index prevents duplicate project/user pairs, and project creation uses a transaction to save the project and lead membership together.

## API Endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | `/signup` | Register a user |
| POST | `/login` | Check user credentials |
| GET | `/api/users` | Get registered users |
| POST | `/api/projects` | Create a project |
| GET | `/api/projects` | List projects |
| GET | `/api/projects/:projectId/members` | List project members |
| POST | `/api/projects/:projectId/members` | Add a member |
| DELETE | `/api/projects/:projectId/members/:userId` | Remove a member |
| GET | `/api/projects/:projectId/stories` | List a project's backlog |
| POST | `/api/user-stories` | Create a user story |
| PATCH | `/api/user-stories/:storyId` | Update story fields except `project_id` |
| DELETE | `/api/user-stories/:storyId` | Delete a story |

## Testing

In `server/`, run `npm test` for API tests or `npm run test:integration` for live Atlas tests. Integration tests create temporary records in `MONGO_DB_NAME` and clean them up at the end; let the run finish.

In `client/`, run `npm run lint` and `npm run build`.

## Note

As in PA2, login checks credentials but does not create a user session. This is a course assignment rather than a production authentication system.
