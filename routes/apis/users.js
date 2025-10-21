var express = require('express');
var usersApiRouter = express.Router();

var {
    getUser,
    createUser,
    updateUser,
    deleteUser
} = require('../../controllers/usersController');

usersApiRouter.route('/')
    .get(getUser)
    .post(createUser)
    .put(updateUser)
    .delete(deleteUser);

// the users/:id route is handled in above route itself.

module.exports = usersApiRouter;