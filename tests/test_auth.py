import unittest

from config import create_app
from db import db
from models.enums import UserRoleEnum


class TestConfig:
    SECRET_KEY = "test-secret"
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    TESTING = True


class AuthFlowTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(TestConfig)
        self.client = self.app.test_client()
        with self.app.app_context():
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def test_register_login_and_profile(self):
        register_response = self.client.post(
            "/register",
            json={
                "user_name": "studentone",
                "email": "student@example.com",
                "password": "Mypass123!",
            },
        )
        self.assertEqual(register_response.status_code, 201)
        register_payload = register_response.get_json()
        self.assertEqual(register_payload["user"]["role"], UserRoleEnum.STUDENT.value)
        self.assertEqual(register_payload["user"]["email"], "student@example.com")
        self.assertIn("token", register_payload)

        login_response = self.client.post(
            "/login",
            json={"email": "student@example.com", "password": "Mypass123!"},
        )
        self.assertEqual(login_response.status_code, 200)
        login_payload = login_response.get_json()
        self.assertEqual(login_payload["user"]["user_name"], "studentone")
        self.assertEqual(login_payload["role"], UserRoleEnum.STUDENT.value)

        profile_response = self.client.get(
            "/login",
            headers={"Authorization": f"Bearer {login_payload['token']}"},
        )
        self.assertEqual(profile_response.status_code, 200)
        profile_payload = profile_response.get_json()
        self.assertEqual(profile_payload["email"], "student@example.com")
        self.assertEqual(profile_payload["role"], UserRoleEnum.STUDENT.value)

    def test_login_rejects_bad_password(self):
        self.client.post(
            "/register",
            json={
                "user_name": "studenttwo",
                "email": "student2@example.com",
                "password": "Mypass123!",
            },
        )

        response = self.client.post(
            "/login",
            json={"email": "student2@example.com", "password": "Wrongpass123!"},
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json()["message"], "Invalid email or password")


if __name__ == "__main__":
    unittest.main()
