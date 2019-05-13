var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session')
const fileUpload = require('express-fileupload');
var flash = require('connect-flash');

var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
// view engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/', express.static(path.join(__dirname, 'public')))

const { Pool, Client } = require('pg')
const pool = new Pool({
  user: 'plfdbppiuuzuar',
  host: 'ec2-54-235-208-103.compute-1.amazonaws.com',
  database: 'd9mmq8k1lr14j6',
  password: 'fdffba354aad9cbda4eaea40eae69247b5c817fc9285c06f309c1a464ef09ee8',
  port: 5432
})

var signinRouter = require('./routes/signin')(pool);
var profileRouter = require('./routes/profile')(pool);
var projectsRouter = require('./routes/projects')(pool);
var usersRouter = require('./routes/users')(pool);

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true
}))
app.use(flash());
app.use(fileUpload());

app.use('/', signinRouter);
app.use('/profile', profileRouter);
app.use('/projects', projectsRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
///usr/bin/pg_dump --host localhost --port 5432 --username "postgres" --role "eki" --no-password  --format custom --blobs --verbose --file "/home/rishiki/practice/pms.backup" "pms"

