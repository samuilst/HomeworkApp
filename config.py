from decouple import config

import app

db_user = config('DB_USER')
db_password = config('DB_PASSWORD')
db_host = config('DB_HOST')
db_name = config('DB_NAME')

class Config:
    SECRET_KEY = config('SECRET_KEY')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    app.config['SQLALCHEMY_DATABASE_URI'] = (
        f'postgresql://{db_user}:{db_password}@{db_host}:5432/{db_name}')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False