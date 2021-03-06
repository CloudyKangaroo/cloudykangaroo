module.exports = function(app, credentials, config, redisClient) {
  "use strict";
  var passport = require('passport');
  var CrowdAuth = credentials.CrowdAuth();
  var AtlassianCrowdStrategy = require('passport-atlassian-crowd').Strategy;
  var LocalStrategy = require('passport-local').Strategy;
  var BasicStrategy = require('passport-http').BasicStrategy;
  var DigestStrategy = require('passport-http').DigestStrategy;
  var ClientPasswordStrategy = require('passport-oauth2-client-password').Strategy;
  var BearerStrategy = require('passport-http-bearer').Strategy;

  var login = require('connect-ensure-login');

  var db;
  if (app.locals.db) {
    db = app.locals.db;
  } else {
    db = require('./db')();
  }

  /**
   * Session Serialization Functions
   */

  /**
   *
   * @param user
   * @param done
   */
  var serializeUser = function(user, returnUserID) {
    var userID = null;
    try {
      userID = new RegExp('[^/]*$').exec(user.id)||[,null][1];
    } catch (err) {
      app.locals.logger.log('error', 'Could not serialize user', {user: user.name, error: err.message});
      returnUserID(err, null);
    }
    redisClient.set("user:"+userID, JSON.stringify(user), function (err, reply) {
      if (err) {
        returnUserID(err, null);
      } else {
        returnUserID(null, userID);
      }
    });
  };

  /**
   *
   * @param id
   * @param done
   */
  var deserializeUser = function(id, returnUser) {
    redisClient.get("user:"+id, function(err, userJSON) {
      var user;
      var error;
      if (err) {
        error = err;
      } else {
        try {
          user = JSON.parse(userJSON);
        }
        catch (er) {
          app.locals.logger.log('error', 'uncaught exception', {error: er});
          error = er;
        }
      }
      returnUser(error, user);
    });
  };

  /*
  Various methods of authenticating a request
  */

  /**
   * Authenticate against CRM Module
   * @param username
   * @param password
   * @param done
   */
  var authenticateCRMUser = function(username, password, done) {
    app.locals.crmModule.authenticateUser(username, password, function (err, userData) {
      var _ = require('underscore');

      if (err) {
        done(err);
      } else {
        var groups = [];

        if (userData.auth_roles)
        {
          var auth_roles = _.values(userData.auth_roles);
          for (var i=0;i<auth_roles.length; i++)
          {
            groups.push(auth_roles[i].name);
          }
        }

        var user = { id: userData.id, name: userData.name, fullname: userData.fullname, emails: [{value: userData.email}], type: userData.type, groups: groups, profile: userData };
        db.users.addUser(user, function(err, user)
        {
          if (err) {
            done(err);
          } else {
            done(null, user);
          }
        });
      }
    });
  };

  /**
   * Authenticate against locate clients DB
   * @param username
   * @param password
   * @param done
   */
  var authenticateClientLocally = function(username, password, done) {
    db.clients.findByClientId(username, function(err, client) {
      if (err) {
        done(err);
      } else if (!client || client.clientSecret !== password) {
        done(null, false);
      } else {
        done(null, client);
      }
    });
  };

  /**
   * Authenticate against locate users DB
   * @param username
   * @param password
   * @param done
   */
  var authenticateUserLocally = function(username, password, done) {
    app.locals.logger.log('debug', 'Authentication Request', {username: username});
    db.users.findByUsername(username, function(err, user) {
      if (err) { app.locals.logger.log('audit', 'Failed to Authenticate', {username: username}); return done(err); }
      if (!user) {  app.locals.logger.log('audit', 'Unknown User', {username: username}); return done(null, false, { message: 'Unknown user ' + username }); }
      if (user.password !== password) { app.locals.logger.log('audit', 'Invalid Password', {username: username});  return done(null, false, { message: 'Invalid password' }); }
      app.locals.logger.log('audit', 'Authenticated User', {username: username}); return done(null, user);
    });
  };

  /**
   * Authenticate Access Token
   * @param accessToken
   * @param done
   */
  var authenticateAccessToken = function(accessToken, done) {
    db.accessTokens.find(accessToken, function(err, token) {
      if (err) {
        done(err);
      } else if (!token) {
        done(null, false);
      } else {
        db.users.find(token.userID, function(err, user) {
          if (err) {
            app.locals.logger.log('error', 'find returned error');
            done(err);
          } else if (!user) {
            app.locals.logger.log('debug', 'find failed to find');
            done(null, false);
          } else {
            var info = { scope: '*' };
            done(null, user, info);
          }
        });
      }
    });
  };

  /**
   * Authentication System
   */

  var authenticationStrategy = 'atlassian-crowd';
  var authenticationAPIStrategy = ['bearer', 'atlassian-crowd'];
  var users = [];

  passport.serializeUser(serializeUser);
  passport.deserializeUser(deserializeUser);

  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    authenticationStrategy = 'local';
    authenticationAPIStrategy = ['bearer', 'local'];
    passport.use(new LocalStrategy(authenticateUserLocally));
  } else if (process.env.NODE_ENV === 'production') {
    authenticationStrategy = 'atlassian-crowd';

    var CrowdOptions = {
      crowdServer: CrowdAuth.server,
      crowdApplication: CrowdAuth.application,
      crowdApplicationPassword: CrowdAuth.password,
      retrieveGroupMemberships: true
    };

    var CrowdLoginCallback = function (userprofile, done) {
      // asynchronous verification, for effect...
      process.nextTick(function () {
        var _ = require('underscore');
        var exists = _.any(users, function (user) {
          return user.id === userprofile.id;
        });

        if (!exists) {
          users.push(userprofile);
        }

        return done(null, userprofile);

      });
    };

    passport.use(new AtlassianCrowdStrategy(CrowdOptions, CrowdLoginCallback));
    passport.use(new LocalStrategy(authenticateCRMUser));
  } else {
    throw new Error(process.env.NODE_ENV +  ' is not a known environment, cannot proceed');
  }

  /**
   * Middleware Called on Each Request
   * @param req
   * @param res
   * @param next
   */
  var handle = function (req, res, next) {
    next();
  };

  /**
   * BasicStrategy & ClientPasswordStrategy
   *
   * These strategies are used to authenticate registered OAuth clients.  They are
   * employed to protect the `token` endpoint, which consumers use to obtain
   * access tokens.  The OAuth 2.0 specification suggests that clients use the
   * HTTP Basic scheme to authenticate.  Use of the client password strategy
   * allows clients to send the same credentials in the request body (as opposed
   * to the `Authorization` header).  While this approach is not recommended by
   * the specification, in practice it is quite common.
   */
  passport.use(new BasicStrategy(authenticateClientLocally));
  passport.use(new DigestStrategy(authenticateClientLocally));
  passport.use(new ClientPasswordStrategy(authenticateClientLocally));

  /**
   * BearerStrategy
   *
   * This strategy is used to authenticate users based on an access token (aka a
   * bearer token).  The user must have previously authorized a client
   * application, which is issued an access token to make requests on behalf of
   * the authorizing user.
   */

  passport.use(new BearerStrategy(authenticateAccessToken));

  module.mockPassport = require('./mockPassport');
  module.passport = passport;
  module.login = login;
  module.handle = handle;
  module.serializeUser = serializeUser;
  module.deserializeUser = deserializeUser;
  module.authenticateClientLocally = authenticateClientLocally;
  module.authenticateUserLocally = authenticateUserLocally;
  module.authenticateAccessToken = authenticateAccessToken;
  module.authenticationStrategy = authenticationStrategy;
  module.authenticationAPIStrategy = authenticationAPIStrategy;
  return module;
};
