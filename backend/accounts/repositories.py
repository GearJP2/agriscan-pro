from .models import User, UserActionLog


class UserRepository:
    """
    Handles all database operations for the User model.
    """

    @staticmethod
    def get_all_users():
        return User._default_manager.all()

    @staticmethod
    def get_user_by_id(user_id: int):
        return User._default_manager.filter(id=user_id).first()

    @staticmethod
    def get_user_by_username(username: str):
        return User._default_manager.filter(username=username).first()

    @staticmethod
    def get_user_by_email(email: str):
        return User._default_manager.filter(email__iexact=email).first()

    @staticmethod
    def create_user(
        username: str, email: str, name: str, password: str, is_active: bool = True
    ):
        return User.objects.create_user(
            username=username,
            email=email,
            name=name,
            password=password,
            is_active=is_active,
        )

    @staticmethod
    def update_user_role(user: User, new_role: str):
        setattr(user, "role", new_role)
        user.save(update_fields=["role"])
        return user

    @staticmethod
    def update_user_status(user: User, is_active: bool):
        setattr(user, "is_active", is_active)
        user.save(update_fields=["is_active"])
        return user


class UserActionLogRepository:
    """
    Handles all database operations for the UserActionLog model.
    """

    @staticmethod
    def log_action(actor: User, target_user: User, action: str, details: str = ""):
        return UserActionLog._default_manager.create(
            actor=actor, target_user=target_user, action=action, details=details
        )
