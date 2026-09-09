# Automatic Code Assessment Platform

An online coding assessment platform built with the MERN stack. Users can register, solve programming problems, submit code, view test-case results, participate in contests, and track their submission history. Faculty and administrators can manage problems, contests, users, and approvals.

## Demo

Try the deployed application:

<https://automatic-code-assessment.onrender.com/>

### Demo account

The demo administrator account is:

```text
Email: admin@example.com
Password: admin1234
```

Use these credentials for demonstration purposes only. Do not reuse this password for a production administrator account.

## Main Features

- Student, faculty, and administrator accounts
- Email-based or ID-based login
- Single active session per account
- Programming problems with visible and hidden test cases
- C++, Java, Python, and JavaScript code execution through Judge0
- Test-case results, execution time, memory usage, and submission history
- Problem creation and management
- Contest creation, assignment, joining, and participation
- Faculty approval workflow for student accounts
- User profiles and profile pictures
- Admin and faculty management views
- Responsive React frontend

## Technology Stack

- React and Vite
- Redux Toolkit and React Router
- Tailwind CSS and Framer Motion
- Node.js and Express
- MongoDB with Mongoose
- Judge0 for secure code execution
- RabbitMQ, Redis, and PostgreSQL for the Judge0 worker stack
- Docker and Docker Compose
- Render for deployment

## Project Structure

```text
client/       React frontend
server/       Express API and code-execution services
docker-compose.yml
sample.env    Environment variable template
judge0.conf.example
```

## Run Locally with Docker

### Prerequisites

Install:

- Docker Desktop
- Git

Copy the environment template and fill in the required values:

```powershell
Copy-Item sample.env .env
```

For the local Docker stack, use these values where applicable:

```env
DOCKER_MONGO_URI=mongodb://mongo:27017/coding-platform
JUDGE0_BASE_URL=http://judge0-server:2358
BACKEND_ORIGIN=http://localhost:5173
```

Copy the Judge0 configuration template and replace its placeholder passwords and token:

```powershell
Copy-Item judge0.conf.example judge0.conf
```

Start the complete application:

```powershell
docker compose up --build -d
```

Open the application at:

<http://localhost:5173>

Local service URLs:

- Frontend: <http://localhost:5173>
- Backend API: <http://localhost:3100>
- Judge0: <http://localhost:2358>
- RabbitMQ dashboard: <http://localhost:15672>

View service status and logs:

```powershell
docker compose ps
docker compose logs -f server
```

Stop the application:

```powershell
docker compose down
```

The MongoDB, PostgreSQL, and Redis data volumes are retained when using `docker compose down`. To remove them as well, use `docker compose down -v`.

## Run Without Docker

Install the dependencies:

```bash
npm run setup-project
```

Run the frontend and backend together:

```bash
npm run dev
```

Or run them separately:

```bash
npm run client
npm run server
```

The non-Docker setup still requires a reachable MongoDB instance and Judge0 service if code execution is enabled.

## Environment Variables

Use `sample.env` as the starting point. Never commit `.env`, `judge0.conf`, API keys, database passwords, or JWT secrets.

### Backend variables

```env
PORT=10000
MONGO_URI=<MongoDB connection string>
JWT_SECRET_KEY=<strong secret>
JWT_EXP=1d
SENDGRID_API_KEY=<SendGrid API key>
ALL_IP=0.0.0.0
BACKEND_ORIGIN=<frontend URL>
JUDGE0_BASE_URL=<Judge0 URL>
JUDGE0_TOKEN=<Judge0 token>
```

`BACKEND_ORIGIN` is the frontend origin, for example `https://your-frontend.onrender.com`. Do not append `/api/v1` to this value.

### Frontend variable

```env
VITE_FRONTEND_ORIGIN=<backend URL>/api/v1
```

This value is embedded into the frontend at build time.

### Local Docker variables

```env
DOCKER_MONGO_URI=mongodb://mongo:27017/coding-platform
RABBITMQ_URL=amqp://judge0:<password>@rabbitmq:5672
```

## Creating an Administrator

The backend includes an administrator creation script. Set these variables in the backend environment:

```env
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<secure password>
```

Then run the script from the `server` directory:

```bash
npm run create-admin
```

The script creates an approved administrator and does not create a second administrator if one already exists. For a deployed Render database, run this command through the backend service environment or a one-off job. Do not use the local Docker MongoDB command for the deployed database.

## Deploy to Render

### Backend Web Service

Create a Render Web Service using:

- Runtime: Docker
- Dockerfile: `server/Dockerfile`
- Docker build context: repository root
- Port: Render's `PORT` value, normally `10000`

Set these environment variables in Render:

```env
NODE_ENV=production
PORT=10000
ALL_IP=0.0.0.0
MONGO_URI=<MongoDB Atlas connection string>
JWT_SECRET_KEY=<new strong secret>
JWT_EXP=1d
SENDGRID_API_KEY=<SendGrid API key>
BACKEND_ORIGIN=https://<frontend-service>.onrender.com
JUDGE0_BASE_URL=<public Judge0 URL>
JUDGE0_TOKEN=<Judge0 token>
```

### Frontend Static Site

Create a Render Static Site using:

- Root directory: `client`
- Build command: `npm ci && npm run build`
- Publish directory: `dist`

Set:

```env
VITE_FRONTEND_ORIGIN=https://<backend-service>.onrender.com/api/v1
```

Add a rewrite rule so React Router routes work after refresh:

```text
Source: /*
Destination: /index.html
Action: Rewrite
```

Judge0 must be hosted separately or made available through a public Judge0 deployment. The current Judge0 Docker stack requires PostgreSQL, Redis, worker processes, and privileged containers, so it should not be treated as a normal Render static site.

## Database Notes

MongoDB Atlas can be used for the deployed application. Add the Render deployment network access as allowed in Atlas, create a database user, and use the resulting connection string as `MONGO_URI`.

If a user account is stuck with an active session, clear the session from MongoDB Atlas Data Explorer:

```javascript
db.users.updateOne(
  { email: "user@example.com" },
  { $set: { sessionId: null } },
);
```

## Troubleshooting

### Render reports a React peer-dependency error

The unused `react-split-pane` dependency was removed because it requires React 16 while this project uses React 18. Use:

```bash
npm ci && npm run build
```

### The frontend cannot reach the API

Check that:

- `VITE_FRONTEND_ORIGIN` points to the deployed backend and ends with `/api/v1`.
- `BACKEND_ORIGIN` points only to the deployed frontend origin.
- The backend has been redeployed after changing environment variables.
- The browser is not using an old cached bundle.

### Code execution fails

Check that `JUDGE0_BASE_URL` is publicly reachable from the backend, `JUDGE0_TOKEN` is valid, and the Judge0 worker, Redis, and PostgreSQL services are running.

## Security

Never commit real environment files or credentials. The repository contains `sample.env` and `judge0.conf.example` for reference. If a secret has ever been committed, rotate it even after removing the file from the latest commit.
