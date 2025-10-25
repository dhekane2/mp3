var express = require('express');
var tasksApiRouter = express.Router();

var {
    getTask,
    createTask,
    
    getTaskById,
    updateTaskById,
    deleteTaskById
} = require('../../controllers/tasksController');

tasksApiRouter.route('/')
    .get(getTask)
    .post(createTask)

// the users/:id route is handled in above route itself.
tasksApiRouter.route('/:id')
    .get(getTaskById)
    .put(updateTaskById)
    .delete(deleteTaskById);

module.exports = tasksApiRouter;