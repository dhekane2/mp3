function testRootApi(req, res) {
    res.json({ "message": "This is a test message. Welcome to the API root for Omkar's MP3!" });
}

module.exports = testRootApi;