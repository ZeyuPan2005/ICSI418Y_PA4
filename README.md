# ICSI418Y_PA3

Programming Assignment 3 for ICSI 418Y Software Engineering. This application builds on the PA2 signup and login system by adding projects and project memberships.

## Features

- Register new users and log in with existing accounts.
- Create projects with a name, description, status, and registered project lead.
- View projects and their leads by name.
- View, add, and remove project members.
- Add the same user to different projects, but prevent duplicate membership in one project.
- Automatically add project leads as members and prevent their removal.
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

Create `server/.env` and set your Atlas connection string:

```dotenv
MONGO_URI=your_mongodb_connection_string
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

The app uses the existing `pa2` database with three collections:

- `users`: registered users from PA2.
- `Projects`: projects with `name`, `description`, `status`, and `project_lead_id`.
- `ProjectMemberships`: relationships stored as `project_id` and `user_id`.

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

## Testing

In `server/`, run `npm test` for API tests or `npm run test:integration` for live Atlas tests. Integration tests create temporary records and clean them up at the end; let the run finish.

In `client/`, run `npm run lint` and `npm run build`.

## Note

As in PA2, login checks credentials but does not create a user session. This is a course assignment rather than a production authentication system.
