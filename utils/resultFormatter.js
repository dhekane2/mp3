function resultFormatter(message, data) {
  return {
    message: typeof message === 'string' ? message : String(message ?? ''),
    data: data === undefined ? null : data
  };
}

module.exports = resultFormatter;
