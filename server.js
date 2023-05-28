// mongodb
require('./config/db');

const app = require('express')();
const port = process.env.PORT || 3000;

// For accepting post from data
const bodyParser = require('express').json;
app.use((bodyParser()));

const userRouter = require('./api/user')
app.use('/user', userRouter)

app.listen(port, () => {
    console.log('Server is running on port ${port}');
})