
const mongoose = require('mongoose');
var User = require('../models/user');
var Task = require('../models/task');
const format = require('../utils/resultFormatter');

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};

const getUser  = async (req, res) => {

    const where = req?.query?.where ? JSON.parse(req.query.where) : {};
    const select = req?.query?.select ? JSON.parse(req.query.select) : null;
    const sort = req?.query?.sort ? JSON.parse(req.query.sort) : null;
    let skip = 0;
    let limit = null;

    // Parse numeric pagination params (not JSON)
    if (req?.query?.skip !== undefined) {
        const s = parseInt(req.query.skip, 10);
        if (Number.isNaN(s) || s < 0) {
            return res.status(400).json(format("Invalid skip parameter. Must be a non-negative integer.", null));
        }
        skip = s;
    }
    if (req?.query?.limit !== undefined) {
        const l = parseInt(req.query.limit, 10);
        if (Number.isNaN(l) || l < 1) {
            return res.status(400).json(format("Invalid limit parameter. Must be a positive integer.", null));
        }
        const MAX_LIMIT = 100;
        limit = Math.min(l, MAX_LIMIT);
    }

    // If only a count is requested, return the total matching docs
    const countOnly = (typeof req?.query?.count !== 'undefined') && String(req.query.count).toLowerCase() === 'true';

    // Case 1: id is provided but invalid
    if ( (where?._id) && (!isValidObjectId(where._id))) {
        return res.status(404).json(format("user not found", []));
    }
    
    try{
        if (countOnly) {
            const total = await User.countDocuments(where).exec();
            return res.json(format('OK', { count: total }));
        }

    let query = User.find(where, select).sort(sort);
    if (skip) query = query.skip(skip);
    if (limit !== null) query = query.limit(limit);
    const result = await query.lean();
    // Case 2: _id is valid but no user found
    if(!result || result.length === 0) return res.status(404).json(format("user not found", []));
        res.json(format('OK', result));
    }
    catch (err) {
        res.status(500).json(format("Error retrieving users.", null));
    }
};

const createUser = async (req, res) => {
    
    if(!req?.body?.name || !req?.body?.email) {
    return res.status(400).json(format("Name and email are required.", null));
    }
    const {name, email} = req.body;

    //Multiple users with the same email cannot exist.
    const existingUser = await User.findOne({ email });
    if(existingUser) {
    return res.status(409).json(format("A user with this email already exists.", null));
    }

    try {
        const newUser = new User({ name, email, pendingTasks: [] });
        const savedUser = await newUser.save();
        res.status(201).json(format('OK', savedUser));
    } catch (err) {
        res.status(400).json(format("Error creating user.", null));
    }   
}


const getUserById = async (req, res) => {
    const id = req.params.id;

    // Parse optional select projection
    let select = null;
    try {
        select = req?.query?.select ? JSON.parse(req.query.select) : null;
    } catch (e) {
    return res.status(404).json(format("User not found. Possibly due to invalid query parameter.", null));
    }

    // Validate ObjectId format
    if (!isValidObjectId(id)) {
    return res.status(404).json(format("User not found. Possibly due to an invalid ID format.", null));
    }
    try {
        const user = await User.findById(id, select).exec();
        if(!user) {
            return res.status(404).json(format(`User with id = ${id} not found.`, null));
        }
        return res.json(format('OK', user));
    } catch (err) {
        return res.status(400).json(format("Error retrieving user.", null));
    }   
};

const updateUserById = async (req, res) => {
    const id = req.params.id;
    // Validate ObjectId format
    if (!isValidObjectId(id)) {
    return res.status(404).json(format("User not found. Possibly due to an invalid ID format.", null));
    }
    try {
        // Validate required fields
        const { name, email, pendingTasks } = req?.body || {};
        if(!name || !email) {
            return res.status(400).json(format("Name and email are required.", null));
        }

        //check for email conflicts
        const duplicate = await User.findOne({ email, _id: { $ne: id } }).exec();
        if(duplicate) {
            return res.status(409).json(format("A user with this email already exists.", null));
        }

        // Load current user [to diff pending tasks]
        const current = await User.findById(id).lean();
        if (!current) {
            return res.status(404).json(format(`User with id = ${id} not found.`, null));
        }

        // Always update core fields
        await User.updateOne({ _id: id }, { $set: { name, email } }, { runValidators: true }).exec();

        // If pendingTasks not provided, we're done
        const pendingProvided = Object.prototype.hasOwnProperty.call(req.body || {}, 'pendingTasks');
        if (!pendingProvided) {
            const updated = await User.findById(id).lean();
            return res.json(format('OK', updated));
        }

        // if pendingTasks are provided, validate it
        if (!Array.isArray(pendingTasks)) {
            return res.status(400).json(format("pendingTasks must be an array of task IDs.", null));
        }
        for (const tId of pendingTasks) {
            if (!isValidObjectId(tId)) {
                return res.status(400).json(format("One or more pendingTasks IDs are invalid.", null));
            }
        }

        // find what's new and what needs to be removed
        const prevPending = (current.pendingTasks || []).map((x) => String(x));
        const newPending = [...new Set(pendingTasks.map(String))];
  
        const toAdd = newPending.filter((x) => !prevPending.includes(x));
        const toRemove = prevPending.filter((x) => !newPending.includes(x));

        // Update the user pendingTasks array
        const updateOps = {};
        if (toAdd.length) {
            updateOps.$addToSet = { pendingTasks: { $each: toAdd } };
        }
        if (toRemove.length) {
            updateOps.$pull = { pendingTasks: { $in: toRemove } };
        }
        if (Object.keys(updateOps).length) {
            await User.updateOne({ _id: id }, updateOps).exec();
        }

        // Propagate to Task side: assign/unassign
        let prevUserIds = [];
        if (toAdd.length) {
            // For toAdd, find previous assignees BEFORE reassigning
            const addedTasksBefore = await Task.find({ _id: { $in: toAdd } }).select('assignedUser completed').lean();
            prevUserIds = [...new Set(
                addedTasksBefore
                    .map((t) => t.assignedUser)
                    .filter((u) => u && String(u) !== String(id))
                    .map((u) => String(u))
            )];

            // Separate completed vs incomplete tasks
            const incompleteTasks = addedTasksBefore.filter(t => !t.completed).map(t => String(t._id));
            const completedTasks = addedTasksBefore.filter(t => t.completed).map(t => String(t._id));

            // Reassign ALL tasks to this user (update assignedUser/assignedUserName)
            await Task.updateMany(
                { _id: { $in: toAdd } },
                { 
                    assignedUser: id, 
                    assignedUserName: name 
                }).exec();

            // Only add INCOMPLETE tasks to this user's pendingTasks
            if (incompleteTasks.length) {
                await User.updateOne(
                    { _id: id },
                    { $addToSet: { pendingTasks: { $each: incompleteTasks } } }
                ).exec();
            }

            // Remove completed tasks from this user's pendingTasks (if somehow they were there)
            if (completedTasks.length) {
                await User.updateOne(
                    { _id: id },
                    { $pull: { pendingTasks: { $in: completedTasks } } }
                ).exec();
            }

            // Pull ALL these tasks (both completed and incomplete) from any previously assigned users
            if (prevUserIds.length) {
                await User.updateMany(
                    { _id: { $in: prevUserIds } },
                    { $pull: { pendingTasks: { $in: toAdd } } }
                ).exec();
            }
        }
        if (toRemove.length) {
            await Task.updateMany(
                { _id: { $in: toRemove }, assignedUser: id },
                { assignedUser: "", assignedUserName: 'unassigned' }
            ).exec();
        }

        const updated = await User.findById(id).lean();
        return res.json(format('OK', updated));
    } catch (err) {
        console.error('updateUserById error:', err);
        return res.status(400).json(format("Error updating user.", null));
    }
};

const deleteUserById = async (req, res) => {
    const id = req.params.id;
    // Validate ObjectId format
    if (!isValidObjectId(id)) {
    return res.status(400).json(format("User not found. Possibly due to an invalid ID format.", null));
    }
    try {
        const deleted = await User.findByIdAndDelete(id).exec();
        if(!deleted) {
            return res.status(404).json(format(`User with id = ${id} not found.`, null));
        }
        // Unassign all tasks previously assigned to this user
        await Task.updateMany(
            { assignedUser: id },
            { assignedUser: "", assignedUserName: 'unassigned' }
        ).exec();

    // Successful deletion: 200 OK, send success message
    return res.status(200).json(format('User deleted successfully.', null));
    } catch (err) {
        return res.status(400).json(format("Error deleting user.", null));
    }
};


module.exports = {
    getUser,
    createUser,

    getUserById,
    updateUserById,
    deleteUserById 
};
