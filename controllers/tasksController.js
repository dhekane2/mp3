const mongoose = require('mongoose');
var Task = require('../models/task');
var User = require('../models/user');
const format = require('../utils/resultFormatter');

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};

// Robust deadline parser: supports ISO strings, numeric milliseconds, and numeric strings (including floats like 1761528737000.0)
const parseDeadlineValue = (val) => {
    if (val == null) return null;
    // Already a valid Date
    if (val instanceof Date && !isNaN(val.getTime())) return val;

    // Number input (can be float). Treat as epoch milliseconds (truncate decimals)
    if (typeof val === 'number' && Number.isFinite(val)) {
        const ms = Math.trunc(val);
        const d = new Date(ms);
        return isNaN(d.getTime()) ? null : d;
    }

    // String input: try numeric first, then ISO/date string
    if (typeof val === 'string') {
        // Attempt numeric parse (e.g., "1761528737000.0")
        const num = Number(val);
        if (!Number.isNaN(num) && Number.isFinite(num)) {
            const ms = Math.trunc(num);
            const d = new Date(ms);
            if (!isNaN(d.getTime())) return d;
        }
        // Fallback: try native Date parsing for ISO-like strings
        const d2 = new Date(val);
        if (!isNaN(d2.getTime())) return d2;
    }

    return null;
};

const getTask = async (req, res) => {

    // Safely parse JSON query params if present
    let where = {};
    let select = null;
    let sort = null;
    let skip = 0;
    let limit = null; // null means no explicit limit
    try {
        where = req?.query?.where ? JSON.parse(req.query.where) : {};
        select = req?.query?.select ? JSON.parse(req.query.select) : null;
        sort = req?.query?.sort ? JSON.parse(req.query.sort) : null;
        // Parse numeric pagination params (not JSON)
        if (req?.query?.skip !== undefined) {
            const s = parseInt(req.query.skip, 10);
            if (Number.isNaN(s) || s < 0) {
                return res.status(400).json({ "message": "Invalid skip parameter. Must be a non-negative integer." });
            }
            skip = s;
        }
        if (req?.query?.limit !== undefined) {
            const l = parseInt(req.query.limit, 10);
            if (Number.isNaN(l) || l < 1) {
                return res.status(400).json({ "message": "Invalid limit parameter. Must be a positive integer." });
            }
            // Cap the maximum limit to prevent excessive payloads
            const MAX_LIMIT = 100;
            limit = Math.min(l, MAX_LIMIT);
        }
    } catch (e) {
        return res.status(400).json({ "message": "Invalid query parameter JSON." });
    }

    // Normalize and validate _id filters, including $in arrays
    if (where && Object.prototype.hasOwnProperty.call(where, '_id')) {
        const idFilter = where._id;

        // Simple string id: validate and cast
        if (typeof idFilter === 'string') {
            if (!isValidObjectId(idFilter)) {
                return res.status(404).json(format("task not found", []));
            }
            where._id = new mongoose.Types.ObjectId(idFilter);
        }
        // Operator object: e.g., { $in: [..] }
        else if (idFilter && typeof idFilter === 'object') {
            // Handle $in
            if (Object.prototype.hasOwnProperty.call(idFilter, '$in')) {
                const ids = idFilter.$in;
                if (!Array.isArray(ids) || ids.length === 0) {
                    return res.status(404).json(format("task not found", []));
                }
                // Validate each id and cast to ObjectId
                if (!ids.every(isValidObjectId)) {
                    return res.status(404).json(format("task not found", []));
                }
                where._id.$in = ids.map((id) => new mongoose.Types.ObjectId(id));
            }
            // Optionally support $nin as well (non-breaking small enhancement)
            else if (Object.prototype.hasOwnProperty.call(idFilter, '$nin')) {
                const ids = idFilter.$nin;
                if (!Array.isArray(ids)) {
                    return res.status(404).json(format("task not found", []));
                }
                if (!ids.every(isValidObjectId)) {
                    return res.status(404).json(format("task not found", []));
                }
                where._id.$nin = ids.map((id) => new mongoose.Types.ObjectId(id));
            }
            // Other operators (e.g., $eq, $ne) fall through without special handling
        }
        // Any other type is invalid
        else if (typeof idFilter !== 'undefined') {
            return res.status(404).json(format("task not found", []));
        }
    }
    
    // If only a count is requested, return the total matching docs (ignores skip/limit)
    const countOnly = (typeof req?.query?.count !== 'undefined') && String(req.query.count).toLowerCase() === 'true';
    if (countOnly) {
        try {
            const total = await Task.countDocuments(where).exec();
            return res.json(format('OK', { count: total }));
        } catch (err) {
            return res.status(500).json({ "message": "Error retrieving tasks count." });
        }
    }

    try{
        let query = Task.find(where, select).sort(sort);
        if (skip) query = query.skip(skip);
        if (limit !== null) query = query.limit(limit);
        const result = await query.lean();
        // Case 2: _id is valid but no task found
    if(!result || result.length === 0) return res.status(404).json(format("task not found", []));
    res.json(format('OK', result));
    }
    catch (err) {
    res.status(500).json(format("Error retrieving tasks.", null));
    }

};

const createTask = async (req, res) => {

    // Validating required fields
    if(!req?.body?.name || !req?.body?.deadline) {
    return res.status(400).json(format("Name and deadline are required.", null));
    }

    const { name, deadline, description, completed, assignedUser, assignedUserName } = req.body;

    // Validating deadline is a valid date (supports ISO strings and numeric ms including floats)
    const deadlineDate = parseDeadlineValue(deadline);
    if(!deadlineDate) {
        return res.status(400).json(format("Invalid deadline format. Please provide a valid date.", null));
    }

    // checking if assignedUser is a valid ObjectId
    if(assignedUser && !isValidObjectId(assignedUser)) {
    return res.status(400).json(format("Invalid assignedUser ID format.", null));
    }

    try {
        const newTask = new Task({ 
            name, 
            deadline: deadlineDate,
            description: description || "",
            completed: completed || false,
            assignedUser: assignedUser || "",
            assignedUserName: assignedUser ? (assignedUserName || "") : "unassigned"
        });

        // If assignedUser provided but no name, derive from User
        if (newTask.assignedUser && (!newTask.assignedUserName || newTask.assignedUserName === "")) {
            const u = await User.findById(newTask.assignedUser).select('name').lean();
            newTask.assignedUserName = u ? u.name : 'unassigned';
        }

        const savedTask = await newTask.save();

        // Add task to user's pendingTasks if assigned AND not completed
        if (savedTask.assignedUser && !savedTask.completed) {
            await User.updateOne(
                { _id: savedTask.assignedUser },
                { $addToSet: { pendingTasks: savedTask._id } }
            );
        }

        res.status(201).json(format('OK', savedTask));
    } catch (err) {
        res.status(400).json(format("Error creating task.", null));
    }
}   



const getTaskById = async (req, res) => {
    const id = req.params.id;

    // Parse optional select projection
    let select = null;
    try {
        select = req?.query?.select ? JSON.parse(req.query.select) : null;
    } catch (e) {
    return res.status(400).json(format("Invalid query parameter JSON.", null));
    }

    // Validate ObjectId format
    if (!isValidObjectId(id)) {
    return res.status(400).json(format("Task not found. Possibly due to an invalid ID format.", null));
    }
    try {
        const task = await Task.findById(id, select).exec();
        if(!task) {
            return res.status(404).json(format(`Task with id = ${id} not found.`, null));
        }
        return res.json(format('OK', task));
    } catch (err) {
        return res.status(400).json(format("Error retrieving task.", null));
    }
};

const updateTaskById = async (req, res) => {
    const id = req.params.id;
    // Validate ObjectId format
    if (!isValidObjectId(id)) {
    return res.status(400).json(format("Task not found. Possibly due to an invalid ID format.", null));
    }
    try {
        const { name, deadline, description, completed, assignedUser, assignedUserName } = req?.body || {};
        if(!name || !deadline) {
            return res.status(400).json(format("Name and deadline are required.", null));
        }
        const deadlineDate = parseDeadlineValue(deadline);
        if(!deadlineDate) {
            return res.status(400).json(format("Invalid deadline format. Please provide a valid date.", null));
        }
        // checking if assignedUser is a valid ObjectId
        if(assignedUser && !isValidObjectId(assignedUser)) {
            return res.status(400).json(format("Invalid assignedUser ID format.", null));
        }
        // Fetch existing task to determine previous assignment
        const prevTask = await Task.findById(id).exec();
        if (!prevTask) {
            return res.status(404).json(format(`Task with id = ${id} not found.`, null));
        }

        // Determine new assignment values
        let newAssignedUser = assignedUser || "";
        let newAssignedUserName = assignedUserName || undefined; // undefined => we may compute

        // If assigning to a user but no name provided, compute from user
        if (newAssignedUser) {
            const u = await User.findById(newAssignedUser).select('name').lean();
            if (!u) {
                return res.status(400).json(format("Assigned user does not exist.", null));
            }
            if (!newAssignedUserName) newAssignedUserName = u.name;
        } else {
            newAssignedUserName = 'unassigned';
        }

        const updatedTask = await Task.findByIdAndUpdate(
            id,
            {
                name,
                deadline: deadlineDate,
                description: description || "",
                completed: !!completed,
                assignedUser: newAssignedUser,
                assignedUserName: newAssignedUserName
            },
            { new: true }
        ).exec();

        if (!updatedTask) {
            return res.status(404).json(format(`Task with id = ${id} not found.`, null));
        }

        // Sync pendingTasks on users
        const prevUserId = prevTask.assignedUser ? String(prevTask.assignedUser) : null;
        const nextUserId = updatedTask.assignedUser ? String(updatedTask.assignedUser) : null;
        const wasCompleted = prevTask.completed;
        const isCompleted = updatedTask.completed;

        // Remove from previous user if assignment changed
        if (prevUserId && prevUserId !== nextUserId) {
            await User.updateOne({ _id: prevUserId }, { $pull: { pendingTasks: updatedTask._id } });
        }

        // Handle current assignment based on completed status
        if (nextUserId) {
            if (isCompleted) {
                // If task is now completed, remove from pendingTasks
                await User.updateOne({ _id: nextUserId }, { $pull: { pendingTasks: updatedTask._id } });
            } else {
                // If task is not completed, add to pendingTasks
                await User.updateOne({ _id: nextUserId }, { $addToSet: { pendingTasks: updatedTask._id } });
            }
        }

        // Also handle case where task was marked completed but assignment didn't change
        // (if same user, wasCompleted=false, isCompleted=true, need to remove)
        if (prevUserId === nextUserId && prevUserId && !wasCompleted && isCompleted) {
            // Already handled above, but this comment clarifies the logic
        }

        return res.json(format('OK', updatedTask));
    } catch (err) {
        return res.status(400).json(format("Error updating task.", null));
    }
};

const deleteTaskById = async (req, res) => {
    const id = req.params.id;
    // Validate ObjectId format
    if (!isValidObjectId(id)) {
    return res.status(400).json(format("Task not found. Possibly due to an invalid ID format.", null));
    }
    try {
        const deleted = await Task.findByIdAndDelete(id).exec();
        if(!deleted) {
            return res.status(404).json(format(`Task with id = ${id} not found.`, null));
        }
        // Remove task from assigned user's pendingTasks
        if (deleted.assignedUser) {
            await User.updateOne(
                { _id: deleted.assignedUser },
                { $pull: { pendingTasks: deleted._id } }
            );
        }
    // Successful deletion: 200 OK, send success message
    return res.status(200).json(format('Task deleted successfully.', null));
    } catch (err) {
        return res.status(400).json(format("Error deleting task.", null));
    }
};



module.exports = {
    getTask,
    createTask,
    
    getTaskById,
    updateTaskById,
    deleteTaskById
};

