
const mongoose = require('mongoose');
var Task = require('../models/task');

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};

const getTask = async (req, res) => {

    const where = req?.query?.where ? JSON.parse(req.query.where) : {};
    const select = req?.query?.select ? JSON.parse(req.query.select) : null;
    const sort = req?.query?.sort ? JSON.parse(req.query.sort) : null;

    // Case 1: id is provided but invalid
    if ( (where?._id) && (!isValidObjectId(where._id))) {
        return res.status(404).json({ "message": "No tasks found." });
    }
    
    try{
        const result = await Task.find(where, select).sort(sort).lean();
        // Case 2: _id is valid but no task found
        if(!result || result.length === 0) return res.status(404).json({ "message": "No tasks found." });
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ "message": "Error retrieving tasks." });
    }

};

const createTask = async (req, res) => {

    // Validating required fields
    if(!req?.body?.name || !req?.body?.deadline) {
        return res.status(400).json({ "message": "Name and deadline are required." });
    }

    const { name, deadline, description, completed, assignedUser, assignedUserName } = req.body;

    // Validating deadline is a valid date
    const deadlineDate = new Date(deadline);
    if(isNaN(deadlineDate.getTime())) {
        return res.status(400).json({ "message": "Invalid deadline format. Please provide a valid date." });
    }

    // checking if assignedUser is a valid ObjectId
    if(assignedUser && !isValidObjectId(assignedUser)) {
        return res.status(400).json({ "message": "Invalid assignedUser ID format." });
    }

    try {
        const newTask = new Task({ 
            name, 
            deadline: deadlineDate,
            description: description || "",
            completed: completed || false,
            assignedUser: assignedUser || "",
            assignedUserName: assignedUserName || "unassigned"
        });
        
        const savedTask = await newTask.save();
        res.status(201).json(savedTask);
    } catch (err) {
        res.status(400).json({ "message": "Error creating task." });
    }
}   

const updateTask = async (req, res) => {
    
}

const deleteTask = async (req, res) => {

}


module.exports = {
    getTask,
    createTask,
    updateTask,
    deleteTask
};

