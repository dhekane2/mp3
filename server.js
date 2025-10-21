// Get the packages we need
var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var bodyParser = require('body-parser');

//middlewares
var allowCrossDomain = require('./config/allowCrossDomain');

//routers
var mainApiRouter = require('./routes/apis/root');
var usersApiRouter = require('./routes/apis/users');

// Read .env file
require('dotenv').config();

var { logger, errorHandler } = require('./middleware/logEvents');


var app = express(); // Create our Express application
var port = process.env.PORT || 3000; // Use environment defined port or 3000

// ##########################################
// Middlewares
// ##########################################

app.use(logger); // Use the logger middleware for all requests
app.use(allowCrossDomain);


// Connect to a MongoDB --> Uncomment this once you have a connection string!!
mongoose.connect(process.env.MONGODB_URI,  {    
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false
});


// Use the body-parser package in our application
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


// ##########################################
// All api routes
// ##########################################
// require('./routes')(app, router);
app.use('/api', mainApiRouter);

// users routes
app.use('/api/users', usersApiRouter);



// ##########################################

app.use(errorHandler);

// Start the server

mongoose.connection.once('open', function() {
    console.log("Connected to MongoDB database");
    app.listen(port, () => console.log('Server running on port ' + port));
});

