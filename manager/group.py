from db import db
from models.enums import UserRoleEnum
from models.group import Group
from models.user import UserModel

class GroupManager:

    @staticmethod
    def create_group(data, current_user):
        if not data.get("name"):
            raise ValueError("Group name is required")

        group = Group(
            name=data["name"],
            owner_id=current_user.id,
            is_private=data.get("is_private", False)
        )
        # owner
        group.members.append(current_user)
        db.session.add(group)
        db.session.commit()
        return group

    @staticmethod
    def add_user_to_group(group_id, user_id, current_user):
        group = Group.query.get(group_id)
        if not group:
            raise ValueError("Group not found")

        if current_user.role != UserRoleEnum.ADMIN and group.owner_id != current_user.id:
            raise PermissionError("Not allowed")

        user = UserModel.query.get(user_id)
        if not user:
            raise ValueError("User not found")

        if user in group.members:
            raise ValueError("User already in group")

        group.members.append(user)
        db.session.commit() 

    @staticmethod
    def remove_user_from_group(group_id, user_id, current_user):
        group = Group.query.get(group_id)
        if not group:
            raise ValueError("Group not found")

        if current_user.role != UserRoleEnum.ADMIN and group.owner_id != current_user.id:
            raise PermissionError("Not allowed")

        user = UserModel.query.get(user_id)
        if not user or user not in group.members:
            raise ValueError("User not in group")

        group.members.remove(user)
        db.session.commit()

    @staticmethod
    def get_group_by_id(group_id, current_user):
        group = Group.query.get(group_id)
        if not group:
            raise ValueError("Group not found")

        if group.is_private:
            is_member = current_user in group.members
            if not is_member and current_user.role != UserRoleEnum.ADMIN:
                raise PermissionError("Private group")

        return group

    @staticmethod
    def delete_group(group_id, current_user):
        group = Group.query.get(group_id)
        if not group:
            raise ValueError("Group not found")

        if current_user.role != UserRoleEnum.ADMIN and group.owner_id != current_user.id:
            raise PermissionError("Not allowed")

        db.session.delete(group)
        db.session.commit()
