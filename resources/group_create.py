from flask import request
from flask_restful import Resource

from manager import auth
from manager.group import GroupManager


class GroupListResource(Resource):


    @auth.login_required
    def get(self):
        current_user = auth.current_user()
        groups = [g for g in current_user.groups]
        return {
            'groups': groups,
            'email': current_user.email
        }

    @auth.login_required
    def post(self):
        current_user = auth.current_user()
        data = request.get_json()
        group = GroupManager.create_group(data, current_user)
        return {
            "Group created": group
        }, 201