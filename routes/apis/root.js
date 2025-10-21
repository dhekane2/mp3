var express = require('express');
var mainApiRouter = express.Router();

var testRootApi = require('../../controllers/testRootApi.js');

mainApiRouter.get('/', testRootApi);

module.exports = mainApiRouter;