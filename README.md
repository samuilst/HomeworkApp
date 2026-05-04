# ClassHub

ClassHub is a Flask web platform for uploading, managing, grading, and tracking homework submissions between students and teachers.

The project includes a Flask REST API, PostgreSQL database models, S3 file upload support, and a complete frontend served directly by Flask.

## Features

- Public user registration creates `STUDENT` accounts only
- Login for `ADMIN`, `TEACHER`, and `STUDENT`
- Group creation and management
- Public and private groups
- Add and remove users from groups
- Assignment creation, editing, and deletion
- Homework file upload to an AWS S3 bucket
- Replace an existing submission by uploading again
- Delete submissions and their S3 files
- Grade submissions
- Add comments to submissions
- Track how many submissions a student has uploaded
- Generate reports for students who have not submitted homework
- Built-in frontend dashboard at `/`

## Tech Stack

- Python
- Flask
- Flask-RESTful
- Flask-SQLAlchemy
- Flask-Migrate / Alembic
- PostgreSQL
- AWS S3 via `boto3`
- HTML, CSS, and JavaScript frontend
- Docker / Docker Compose

## Project Structure

```text
.
├── app.py
├── config.py
├── db.py
├── Dockerfile
├── docker-compose.yml
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── manager/
├── models/
├── resources/
├── schemas/
├── migrations/
└── requirements.txt
```

## Environment Variables

Create or update `.env` in the project root:

```env
SECRET_KEY=your-secret-key

DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=db
DB_NAME=classhub

AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION_NAME=eu-central-1
AWS_S3_BUCKET_NAME=your-bucket-name
```

When running without Docker and using a local PostgreSQL server, set:

```env
DB_HOST=localhost
```

When running with Docker Compose, use:

```env
DB_HOST=db
```

## AWS S3 Setup

1. Create an S3 bucket in AWS.
2. Create an IAM user or role with access to that bucket.
3. Add the AWS credentials and bucket name to `.env`.
4. Make sure the IAM policy allows at least:

```text
s3:PutObject
s3:DeleteObject
s3:GetObject
```

Example resource:

```text
arn:aws:s3:::your-bucket-name/*
```

Uploaded homework files are stored in S3 and the database saves the path in this format:

```text
s3://your-bucket-name/assignments/<assignment_id>/students/<student_id>/<file>
```

## Run With Docker Compose

Build and start the project:

```powershell
docker compose up --build
```

Run database migrations:

```powershell
docker compose exec web flask db upgrade
```

Open the app:

```text
http://localhost:5000/dashboard
```

## Run From PyCharm With Docker

1. Open the project in PyCharm.
2. Make sure Docker is running.
3. Open Docker Compose configuration.
4. Select `docker-compose.yml`.
5. Use the `web` service.
6. Make sure port `5000:5000` is exposed.
7. Make sure `.env` is loaded.
8. Start the service.
9. Run migrations:

```powershell
docker compose exec web flask db upgrade
```

Then open:

```text
http://localhost:5000/dashboard
```

## Run Without Docker

Install dependencies:

```powershell
pip install -r requirements.txt
```

Run migrations:

```powershell
flask db upgrade
```

Start the app:

```powershell
python app.py
```

Open:

```text
http://localhost:5000/dashboard
```

## Frontend

The frontend is located in:

```text
frontend/
```

It is served by Flask automatically. No separate Node.js or frontend server is required.

Frontend routes:

```text
/dashboard
/files
/homework
/teacher
/admin
/settings
```

Main pages in the dashboard:

- Login and registration
- Dashboard overview
- Files grid and S3 upload
- Homework, groups, grading, and missing submission reports
- Teacher tools for users with `TEACHER` or `ADMIN` role
- Admin tools for users with `ADMIN` role
- Settings and S3 configuration helper

The `/teacher` tab is visible only after logging in as `TEACHER` or `ADMIN`.
The `/admin` tab is visible only after logging in as `ADMIN`.

## Main API Endpoints

### Auth

```text
POST /registry
POST /login
GET  /login
```

`POST /registry` always creates a `STUDENT` account. Teacher and admin accounts must be created or promoted directly in the database.

### Groups

```text
GET    /groups
POST   /groups
GET    /groups/<group_id>
DELETE /groups/<group_id>
POST   /groups/<group_id>/users
DELETE /groups/<group_id>/users/<user_id>
```

### Assignments

```text
GET    /assignments
POST   /assignments
PUT    /assignments/<assignment_id>
DELETE /assignments/<assignment_id>
GET    /assignments/<assignment_id>/missing-submissions
```

### Submissions

```text
GET    /submissions
POST   /submissions
DELETE /submissions
PUT    /submissions/<assignment_id>/<student_id>
GET    /students/<student_id>/submission-count
```

### Admin

Only users with role `ADMIN` can access these endpoints.

```text
GET    /admin/stats
GET    /admin/users
POST   /admin/users
GET    /admin/users/<user_id>
PUT    /admin/users/<user_id>
DELETE /admin/users/<user_id>
GET    /admin/groups
GET    /admin/assignments
GET    /admin/submissions
```

Admin users can:

- View platform statistics
- List all users
- Create users with `STUDENT`, `TEACHER`, or `ADMIN` role
- Update user profile data and role
- Delete users
- View all groups, assignments, and submissions

Example create teacher:

```powershell
curl -X POST http://localhost:5000/admin/users `
  -H "Authorization: Bearer ADMIN_TOKEN" `
  -H "Content-Type: application/json" `
  -d "{\"user_name\":\"teacher1\",\"email\":\"teacher1@test.com\",\"password\":\"Mypass123!\",\"role\":\"TEACHER\"}"
```

### Teacher

Users with role `TEACHER` or `ADMIN` can access these endpoints.

```text
GET  /teacher/dashboard
GET  /teacher/groups
GET  /teacher/students
POST /teacher/students
```

Teachers can:

- View a dashboard for their own groups
- List groups they own
- List students from their groups
- Create student accounts
- Optionally add a newly created student to one of their groups

Example create student and add to group:

```powershell
curl -X POST http://localhost:5000/teacher/students `
  -H "Authorization: Bearer TEACHER_TOKEN" `
  -H "Content-Type: application/json" `
  -d "{\"user_name\":\"student1\",\"email\":\"student1@test.com\",\"password\":\"Mypass123!\",\"group_id\":1}"
```

## Upload Homework

Homework upload uses `multipart/form-data`.

Required fields:

```text
assignment_id
file
```

Example with `curl`:

```powershell
curl -X POST http://localhost:5000/submissions `
  -H "Authorization: Bearer YOUR_TOKEN" `
  -F "assignment_id=1" `
  -F "file=@C:\path\to\homework.pdf"
```

## User Roles

### Admin

- Full access to users, groups, assignments, and submissions
- Can delete groups, assignments, and submissions
- Can view reports
- Can create and manage teacher/admin/student users through `/admin/users`
- Must be created or promoted directly in the database

### Teacher

- Can create and manage own groups
- Can create assignments
- Can grade submissions
- Can add comments
- Can view public group submissions
- Can create student accounts through `/teacher/students`
- Must be created or promoted directly in the database

### Student

- Can register and log in
- Can create groups
- Can upload homework
- Can view grades and comments
- Can access groups where they are a member

## Useful Commands

Check changed files:

```powershell
git status --short
```

Run Python compile check:

```powershell
python -m compileall app.py config.py manager models resources schemas
```

Rebuild Docker containers:

```powershell
docker compose up --build
```

Stop Docker containers:

```powershell
docker compose down
```

## Notes

- The frontend and backend run on the same address: `http://localhost:5000`.
- S3 credentials must be valid before file upload works.
- If Docker is used, `DB_HOST` should usually be `db`.
- If local PostgreSQL is used, `DB_HOST` should usually be `localhost`.
- Run `flask db upgrade` after pulling or creating migrations.
