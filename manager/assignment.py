from datetime import date

from db import db
from models.assignment import Assignment
from models.group import Group


class AssignmentManager:

    @staticmethod
    def create_assignment(data, current_user):
        if current_user.role != "teacher":
            raise PermissionError("Only teachers can create assignments")

        group = Group.query.get(data["group_id"])
        if not group:
            raise ValueError("Group not found")

        if group.owner_id != current_user.id:
            raise PermissionError("You are not the owner of this group")

        if "due_date" in data and data["due_date"] < date.today():
            raise ValueError("Due date must be today or later")

        assignment = Assignment(
            group_id=data["group_id"],
            title=data["title"],
            description=data.get("description"),
            due_date=data.get("due_date"),
            created_by=current_user.id
        )

        db.session.add(assignment)
        db.session.commit()

        return assignment

    @staticmethod
    def update_assignment(assignment_id, data, current_user):
        assignment = Assignment.query.get(assignment_id)
        if not assignment:
            raise ValueError("Assignment not found")

        if current_user.role != "teacher":
            raise PermissionError("Only teachers can update")

        if assignment.created_by != current_user.id:
            raise PermissionError("Not your assignment")

        assignment.title = data.get("title", assignment.title)
        assignment.description = data.get("description", assignment.description)

        db.session.commit()
        return assignment

    @staticmethod
    def delete_assignment(assignment_id, current_user):
        assignment = Assignment.query.get(assignment_id)
        if not assignment:
            raise ValueError("Assignment not found")

        if current_user.role != "admin" and assignment.created_by != current_user.id:
            raise PermissionError("Not allowed")

        db.session.delete(assignment)
        db.session.commit()