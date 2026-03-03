from flask import Flask
from flask_migrate import Migrate
from flask_restful import Api
from decouple import config

# 1. Import the db instance from your db.py file
from db import db

# 2. CRUCIAL: Import your models so Flask-Migrate can "see" them
# If your class names are different (e.g., User instead of UserModel), fix these names!
from models.user import UserModel
from models.assignment import Assignment
from models.group import Group
from models.group_user import GroupUser
from models.submission import Submission
from resources.routes import routes

app = Flask(__name__)

# Configuration
db_user = config('DB_USER')
db_password = config('DB_PASSWORD')
db_host = config('DB_HOST')
db_name = config('DB_NAME')

app.config['SQLALCHEMY_DATABASE_URI'] = (
    f'postgresql://{db_user}:{db_password}@{db_host}:5432/{db_name}')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 3. Initialize the db with the app
db.init_app(app)

api = Api(app)
migrate = Migrate(app, db)

[api.add_resource(*route) for route in routes]

if __name__ == '__main__':
    app.run(debug=True)
# {
# 	"user_name" : "Name2",
#     "email" : "email2@gmail.com",
#     "password" : "Mypass123!",
#     "role" : "ADMIN"
# }