var fsPromises = require('fs').promises
var path = require('path')
var { format } = require('date-fns');
var fs = require('fs');

const logEvents = async (message, logName) => {
  const dateTime = format(new Date(), 'yyyyMMdd\tHH:mm:ss');
  const logItem = `${dateTime}\t${message}\n`;

  try {
    const logsDir = path.join(__dirname, '..','logs');
    if (!fs.existsSync(logsDir)) {
      await fsPromises.mkdir(logsDir);
    }
    await fsPromises.appendFile(path.join(logsDir, logName), logItem);
  } catch (err) {
    console.error(err);
  }
};

const logger = (req, res, next) => {
  logEvents(`${req.method}\t${req.url}`, 'reqLog.txt');
  console.log(`${req.method} ${req.path}`);
  next();
}

const errorHandler = (err, req, res, next) => {
    logEvents(`${err.name}: ${err.message}`, 'errLog.txt');
    console.error(err.stack);
    res.status(500).send('Something broke!');
};

module.exports = { logger, logEvents, errorHandler };