from sqlalchemy.exc import IntegrityError

from db import db
from models.group import Group
from models.group_user import GroupUser


class GroupManager:

    @staticmethod
    def create_group(data, current_user):
        # if current_user.role != "teacher":
        #     raise PermissionError("Only teachers can create groups")

        group = Group(
            name=data["name"],
            owner_id=current_user.id,
            is_private=data.get("is_private", False)
        )

        db.session.add(group)
        db.session.commit()

        # owner automatically becomes member
        member = GroupUser(group_id=group.id, user_id=current_user.id)
        db.session.add(member)
        db.session.commit()

        return group

    @staticmethod
    def add_user_to_group(group_id, user_id, current_user):
        group = Group.query.get(group_id)
        if not group:
            raise ValueError("Group not found")

        if current_user.role != "admin" and group.owner_id != current_user.id:
            raise PermissionError("Not allowed")

        membership = GroupUser(group_id=group_id, user_id=user_id)

        try:
            db.session.add(membership)
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            raise ValueError("User already in group")

    @staticmethod
    def remove_user_from_group(group_id, user_id, current_user):
        group = Group.query.get(group_id)
        if not group:
            raise ValueError("Group not found")

        if current_user.role != "admin" and group.owner_id != current_user.id:
            raise PermissionError("Not allowed")

        membership = GroupUser.query.filter_by(
            group_id=group_id,
            user_id=user_id
        ).first()

        if not membership:
            raise ValueError("User not in group")

        db.session.delete(membership)
        db.session.commit()

    @staticmethod
    def get_group_by_id(group_id, current_user):
        group = Group.query.get(group_id)
        if not group:
            raise ValueError("Group not found")

        if group.is_private:
            member = GroupUser.query.filter_by(
                group_id=group_id,
                user_id=current_user.id
            ).first()

            if not member and current_user.role != "admin":
                raise PermissionError("Private group")

        return group

    @staticmethod
    def delete_group(group_id, current_user):
        group = Group.query.get(group_id)
        if not group:
            raise ValueError("Group not found")

        if current_user.role != "admin" and group.owner_id != current_user.id:
            raise PermissionError("Not allowed")

        db.session.delete(group)
        db.session.commit()