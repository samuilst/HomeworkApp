import os

from decouple import config
from flask import Flask, send_from_directory
from flask_migrate import Migrate
from flask_restful import Api
from marshmallow import ValidationError

from db import db
from resources.routes import routes

db_user = config('DB_USER')
db_password = config('DB_PASSWORD')
db_host = config('DB_HOST')
db_port = config('DB_PORT', default='5432')
db_name = config('DB_NAME')

class Config:
    SECRET_KEY = config('SECRET_KEY')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = (
        f'postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}')

def create_app(config = 'config.DevelopmentConfig'):
    app = Flask(__name__, static_folder=None)
    app.config.from_object(config)
    frontend_folder = os.path.join(app.root_path, "frontend")

    api = Api(app)
    migrate = Migrate(app, db)

    @app.errorhandler(ValidationError)
    def handle_validation_error(error):
        return {"message": "Validation error", "errors": error.messages}, 400

    @app.errorhandler(ValueError)
    def handle_value_error(error):
        return {"message": str(error)}, 400

    @app.errorhandler(PermissionError)
    def handle_permission_error(error):
        return {"message": str(error)}, 403

    @app.errorhandler(RuntimeError)
    def handle_runtime_error(error):
        return {"message": str(error)}, 500

    [api.add_resource(*route) for route in routes]

    @app.route("/")
    def frontend_index():
        return send_from_directory(frontend_folder, "index.html")

    @app.route("/<path:path>")
    def frontend_assets(path):
        if path in {"dashboard", "files", "homework", "settings"}:
            return send_from_directory(frontend_folder, "index.html")
        return send_from_directory(frontend_folder, path)

    return app
