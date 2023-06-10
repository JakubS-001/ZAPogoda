app.use(express.json());

require('./api/get');

require('./api/post');

require('./api/delete');

app.get(['/api', '/api/*'], (req, res) => {
    res.status(400).send({message: "Invalid API path"});
})

app.post(['/api', '/api/*'], (req, res) => {
    res.status(400).send({message: "Invalid API path"});
})
