from flask import Flask
from flask_migrate import Migrate
from flask_restful import Api
from decouple import config

from db import db


from resources.routes import routes

app = Flask(__name__)

db.init_app(app)

api = Api(app)
migrate = Migrate(app, db)

for route in routes:
    api.add_resource(*route)

if __name__ == '__main__':
    app.run(debug=True)


# {
# 	"user_name" : "Name2",
#     "email" : "email2@gmail.com",
#     "password" : "Mypass123!",
#     "role" : "ADMIN"
# }