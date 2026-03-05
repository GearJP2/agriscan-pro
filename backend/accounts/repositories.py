from .models import User, UserActionLog

class UserRepository:
    """
    Handles all database operations for the User model.
    """
    
    @staticmethod
    def get_all_users():
        return User.objects.all()

    @staticmethod
    def get_user_by_id(user_id: int):
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None

    @staticmethod
    def get_user_by_username(username: str):
        try:
            return User.objects.get(username=username)
        except User.DoesNotExist:
            return None

    @staticmethod
    def create_user(username: str, email: str, name: str, password: str):
        return User.objects.create_user(
            username=username,
            email=email,
            name=name,
            password=password
        )

    @staticmethod
    def update_user_role(user: User, new_role: str):
        user.role = new_role
        user.save(update_fields=['role'])
        return user

    @staticmethod
    def update_user_status(user: User, is_active: bool):
        user.is_active = is_active
        user.save(update_fields=['is_active'])
        return user


class UserActionLogRepository:
    """
    Handles all database operations for the UserActionLog model.
    """
    
    @staticmethod
    def log_action(actor: User, target_user: User, action: str, details: str = ""):
        return UserActionLog.objects.create(
            actor=actor,
            target_user=target_user,
            action=action,
            details=details
        )
