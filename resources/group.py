from flask import request
from flask_restful import Resource

from manager.auth import auth
from manager.group import GroupManager
from schemas.group import GroupCreateSchema, GroupUserSchema

group_schema = GroupCreateSchema()
group_user_schema = GroupUserSchema()


class GroupListResource(Resource):


    @auth.login_required
    def get(self):
        current_user = auth.current_user()
        groups = [
            {
                "id": g.id,
                "name": g.name,
                "private": g.is_private
            }
            for g in current_user.groups
        ]
        return {
            'groups': groups,
            'email': current_user.email
        }

    @auth.login_required
    def post(self):
        current_user = auth.current_user()
        data = group_schema.load(request.get_json() or {})
        group = GroupManager.create_group(data, current_user)
        return {
            "id": group.id,
            "name": group.name,
            "is_private": group.is_private
        }, 201

class GroupDeleteResource(Resource):

    @auth.login_required
    def delete(self, group_id):

        current_user = auth.current_user()

        GroupManager.delete_group(group_id, current_user)

        return {"message": "Group deleted"}, 200


class GroupAddUserResource(Resource):

    @auth.login_required
    def post(self, group_id):
        current_user = auth.current_user()
        data = group_user_schema.load(request.get_json() or {})

        GroupManager.add_user_to_group(
            group_id,
            data["user_id"],
            current_user
        )

        return {"message": "User added to group"}, 200


class GroupRemoveUserResource(Resource):

    @auth.login_required
    def delete(self, group_id, user_id):

        current_user = auth.current_user()

        GroupManager.remove_user_from_group(
            group_id,
            user_id,
            current_user
        )

        return {"message": "User removed"}, 200

class GroupDetailResource(Resource):

    @auth.login_required
    def get(self, group_id):

        current_user = auth.current_user()

        group = GroupManager.get_group_by_id(
            group_id,
            current_user
        )

        return {
            "id": group.id,
            "name": group.name,
            "owner_id": group.owner_id,
            "is_private": group.is_private,
            "members": [
                {
                    "id": member.id,
                    "user_name": member.user_name,
                    "email": member.email,
                    "role": member.role.value,
                }
                for member in group.members
            ],
            "assignments": [
                {
                    "id": assignment.id,
                    "title": assignment.title,
                    "description": assignment.description,
                    "due_date": assignment.due_date.isoformat() if assignment.due_date else None,
                }
                for assignment in group.assignments
            ],
        }

    @auth.login_required
    def put(self, group_id):
        current_user = auth.current_user()
        data = group_schema.load(request.get_json() or {}, partial=True)
        group = GroupManager.update_group(group_id, data, current_user)

        return {
            "id": group.id,
            "name": group.name,
            "is_private": group.is_private,
            "owner_id": group.owner_id,
        }, 200
