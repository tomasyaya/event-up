
require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const flash = require('connect-flash');
const hbs = require('hbs');
const passport = require('passport');
const facebookConfiguration = require('./helpers/configuration');
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('./models/User');
const authRouter = require('./routes/auth');
const apiRouter = require('./routes/api');
const usersRouter = require('./routes/users');
const indexRouter = require('./routes/index');
const eventsRouter = require('./routes/events');
const deleteRouter = require('./routes/delete');
const weatherRouter = require('./routes/weather');
const commentsRouter = require('./routes/comments');

const messagesRouter = require('./routes/messages');
const app = express();

app.use(session({
  store: new MongoStore({
    mongooseConnection: mongoose.connection,
    ttl: 24 * 60 * 60 // 1 day
  }),
  secret: 'some-string',
  resave: true,
  saveUninitialized: true,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(flash());

mongoose.connect(process.env.MONGODB_URI, {
  keepAlive: true,
  useNewUrlParser: true,
  reconnectTries: Number.MAX_VALUE
});

// Use the FacebookStrategy within Passport.

passport.use(new FacebookStrategy(facebookConfiguration,
  async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await User.findOne({ facebookId: profile.id });
      if (user) return done(null, user);

      const newUser = {
        username: profile.id,
        name: profile.displayName,
        facebook: true,
        token: accessToken,
        facebookId: profile.id
      };

      const createdUser = await User.create(newUser);
      done(null, createdUser);
    } catch (error) {
      done(error);
    }
  }
));

// ------ Passport configuration ----

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
hbs.registerPartials(path.join(__dirname, '/views/partials'));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  app.locals.currentUser = req.session.currentUser;
  next();
});

app.use('/', indexRouter);
app.use('/auth', authRouter);
app.use('/api', apiRouter);
app.use('/users', usersRouter);
app.use('/events', eventsRouter);
app.use('/delete', deleteRouter);
app.use('/messages', messagesRouter);
app.use('/comments', commentsRouter);
app.use('/weather', weatherRouter);

// NOTE: requires a views/not-found.ejs template
app.use((req, res, next) => {
  res.status(404);
  res.render('not-found');
});

// NOTE: requires a views/error.ejs template
app.use((err, req, res, next) => {
  // always log the error
  console.error('ERROR', req.method, req.path, err);

  // only render if the error ocurred before sending the response
  if (!res.headersSent) {
    res.status(500);
    res.render('error');
  }
});

module.exports = app;
