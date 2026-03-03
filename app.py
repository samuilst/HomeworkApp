from flask import Flask
from flask_migrate import Migrate
from flask_restful import Api
from decouple import config

from db import db

from models.user import UserModel
from models.assignment import Assignment
from models.group import Group
from models.submission import Submission
from resources.routes import routes

app = Flask(__name__)

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