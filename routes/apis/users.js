var express = require('express');
var usersApiRouter = express.Router();

var {
    getUser,
    createUser,
    getUserById,
    updateUserById,
    deleteUserById
} = require('../../controllers/usersController');

usersApiRouter.route('/')
    .get(getUser)
    .post(createUser)
    // .put(updateUser)
    // .delete(deleteUser);

// the users/:id route is handled in above route itself.
usersApiRouter.route('/:id')
    .get(getUserById)
    .put(updateUserById)
    .delete(deleteUserById);
    
module.exports = usersApiRouter;