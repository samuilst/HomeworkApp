from config import create_app
from db import db

app = create_app()
with app.app_context():
    db.init_app(app)

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000, debug=True)


# {
# 	"user_name" : "Name2",
#     "email" : "email2@gmail.com",
#     "password" : "Mypass123!",
#     "role" : "ADMIN"
# }
