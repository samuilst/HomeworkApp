# ClassHub

ClassHub is a Flask homework management app for teachers, students, and admins. It includes a Flask REST API, PostgreSQL models, AWS S3 uploads, and a frontend served directly by Flask.

## Features

- Public registration creates `STUDENT` accounts only
- Login for `ADMIN`, `TEACHER`, and `STUDENT`
- Teachers/admins create and manage groups
- Teachers/admins add students to groups with a username-sorted dropdown
- Teachers/admins create, edit, and delete homework
- Students view assigned homework and upload submissions
- Students view their own grades and comments
- Teachers/admins grade submissions and generate missing-submission reports
- Homework files are uploaded to AWS S3
- Admin dashboard for users, groups, homework, and submissions

## Tech Stack

- Python, Flask, Flask-RESTful
- Flask-SQLAlchemy, Flask-Migrate, Alembic
- PostgreSQL
- AWS S3 through `boto3`
- HTML, CSS, JavaScript
- Docker and Docker Compose

## Project Structure

```text
.
├── app.py
├── config.py
├── db.py
├── Dockerfile
├── docker-compose.yml
├── frontend/
│   ├── app.js
│   ├── favicon.svg
│   ├── index.html
│   └── styles.css
├── manager/
├── migrations/
├── models/
├── resources/
├── schemas/
└── requirements.txt
```

## Environment

Create a `.env` file in the project root:

```env
SECRET_KEY=change-this-to-a-long-random-secret

DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=classhub

AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION_NAME=eu-central-1
AWS_S3_BUCKET_NAME=your-bucket-name
```

Use `DB_HOST=db` when running with Docker Compose.

## AWS S3 Integration

1. Create an S3 bucket in AWS, for example `classhub-homework-files`.
2. Keep public access blocked unless you intentionally add download links later.
3. Create an IAM user for local development, or use an IAM role if deployed on AWS.
4. Give it only the bucket permissions this app needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

5. Put the credentials and bucket name in `.env`.
6. Install dependencies with `pip install -r requirements.txt`; `boto3` is already listed.
7. Start the app and upload a file from the Files page.

The app stores uploaded files under:

```text
s3://<bucket>/assignments/<assignment_id>/students/<student_id>/<uuid>-<filename>
```

If you deploy to AWS later, prefer an IAM role over storing access keys in `.env`. The S3 client supports both explicit `.env` credentials and the standard AWS credential chain.

## Run With Docker Compose

```powershell
docker compose up --build
docker compose exec web flask db upgrade
```

Open:

```text
http://localhost:5000/dashboard
```

## Run Locally

```powershell
pip install -r requirements.txt
flask db upgrade
python app.py
```

Open:

```text
http://localhost:5000/dashboard
```

## Main Routes

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

GET    /groups
POST   /groups
GET    /groups/<group_id>
PUT    /groups/<group_id>
DELETE /groups/<group_id>
POST   /groups/<group_id>/users
DELETE /groups/<group_id>/users/<user_id>

GET    /assignments
POST   /assignments
PUT    /assignments/<assignment_id>
DELETE /assignments/<assignment_id>
GET    /assignments/<assignment_id>/missing-submissions

GET    /submissions
POST   /submissions
DELETE /submissions
PUT    /submissions/<assignment_id>/<student_id>
GET    /students/<student_id>/submission-count

GET    /teacher/dashboard
GET    /teacher/groups
GET    /teacher/students
GET    /teacher/students?scope=all
POST   /teacher/students

GET    /admin/stats
GET    /admin/users
POST   /admin/users
GET    /admin/users/<user_id>
PUT    /admin/users/<user_id>
PATCH  /admin/users/<user_id>/role
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
- Change only a user's role through `PATCH /admin/users/<user_id>/role`
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

Admin:

- Full access to users, groups, homework, submissions, and reports
- Can create teacher, student, and admin users
- Can delete users except their own account

Teacher:

- Can create and manage own groups
- Can add/remove students from own groups
- Can create homework for own groups
- Can grade own homework submissions
- Can create student accounts

Student:

- Can register and sign in
- Can view assigned homework
- Can upload homework submissions
- Can view their own grades and comments

## Useful Commands

```powershell
git status --short
python -m compileall app.py config.py manager models resources schemas
flask db upgrade
docker compose up --build
docker compose down
```
