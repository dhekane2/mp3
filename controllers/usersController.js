
const mongoose = require('mongoose');
var User = require('../models/user');

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};

const getUser  = async (req, res) => {

    const where = req?.query?.where ? JSON.parse(req.query.where) : {};
    const select = req?.query?.select ? JSON.parse(req.query.select) : null;
    const sort = req?.query?.sort ? JSON.parse(req.query.sort) : null;

    // Case 1: id is provided but invalid
    if ( (where?._id) && (!isValidObjectId(where._id))) {
        return res.status(404).json({ "message": "No users found." });
    }
    
    try{
        const result = await User.find(where, select).sort(sort).lean();
        // Case 2: _id is valid but no user found
        if(!result || result.length === 0) return res.status(404).json({ "message": "No users found." });
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ "message": "Error retrieving users." });
    }

};

const createUser = async (req, res) => {
    
    if(!req?.body?.name || !req?.body?.email) {
        return res.status(400).json({ "message": "Name and email are required." });
    }
    const {name, email} = req.body;

    //Multiple users with the same email cannot exist.
    const existingUser = await User.findOne({ email });
    if(existingUser) {
        return res.status(409).json({ "message": "A user with this email already exists." });
    }

    try {
        const newUser = new User({ name, email, pendingTasks: [] });
        const savedUser = await newUser.save();
        res.status(201).json(savedUser);
    } catch (err) {
        res.status(400).json({ "message": "Error creating user." });
    }   
}

const updateUser = async (req, res) => {
    const where = req?.query?.where ? JSON.parse(req.query.where) : {};

    if(!where?._id) {
        return res.status(404).json({ "message": "User ID in where clause is required." });
    }
    const id = where._id;
    
    
    // Validate the ObjectId format
    if (!isValidObjectId(id)) {
        return res.status(400).json({ "message": `User not found. Possibly due to an invalid ID format.` });
    }

    try {
        // Check if user exists
        const current = await User.findById(id);
        if(!current) return res.status(404).json({ "message": `User with id = ${id} not found.` });

        const { name, email, pendingTasks } = req?.body || {};
        if(!name || !email) {
            return res.status(400).json({ "message": "Name and email are required." });
        }
        
        const duplicate = await User.findOne({ email, _id: { $ne: id } }).exec();
        if(duplicate) {
            return res.status(409).json({ "message": "A user with this email already exists." });
        }

        const replacement = {
            name,
            email,
            pendingTasks: Array.isArray(pendingTasks) ? pendingTasks : [],
            dateCreated: new Date()
        };

        const updated = await User.findOneAndUpdate(
            { _id: id },
            replacement,
            {  
                new: true, 
                runValidators: true, 
                overwrite: true 
            }).exec();

        return res.json(updated);
    } catch (err) {
        return res.status(400).json({ "message": "Error replacing user." });
    }
}

const deleteUser = async (req, res) => {
    const where = req?.query?.where ? JSON.parse(req.query.where) : {};

    // Require an id in where clause (aligning with current updateUser behavior)
    if(!where?._id) {
        return res.status(404).json({ "message": "User ID in where clause is required." });
    }

    const id = where._id;

    // Validate ObjectId format
    if (!isValidObjectId(id)) {
        return res.status(400).json({ "message": "User not found. Possibly due to an invalid ID format." });
    }

    try {
        const deleted = await User.findByIdAndDelete(id).exec();
        if(!deleted) {
            return res.status(404).json({ "message": `User with id = ${id} not found.` });
        }
        return res.json(deleted);
    } catch (err) {
        return res.status(400).json({ "message": "Error deleting user." });
    }
}


module.exports = {
    getUser,
    createUser,
    updateUser,
    deleteUser  
};

