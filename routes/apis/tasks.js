var express = require('express');
var tasksApiRouter = express.Router();

var {
    getTask,
    createTask,
    updateTask,
    deleteTask
} = require('../../controllers/tasksController');

tasksApiRouter.route('/')
    .get(getTask)
    .post(createTask)
    .put(updateTask)
    .delete(deleteTask);

// the users/:id route is handled in above route itself.

module.exports = tasksApiRouter;