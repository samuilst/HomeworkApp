from resources.user import UserRegistryResource, UserSignInResource

routes = (
    (UserRegistryResource, "/registry"),
    (UserSignInResource, '/login'),
)