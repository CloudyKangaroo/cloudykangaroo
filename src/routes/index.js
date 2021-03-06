module.exports = function (app, config, authenticator, redisClient) {
  "use strict";

  require('./auth')(app, config, authenticator, redisClient);
//  require(app.get('base_lib_dir') + '/modules/helpdesk')(app, config, authenticator, redisClient);
  require('features-helpdesk')(app, config, authenticator, redisClient);
  require('features-configuration')(app, config, authenticator, redisClient);
  require('./monitoring')(app, config, authenticator, redisClient);
  require('./account')(app, config, authenticator, redisClient);
  require('./events')(app, config, authenticator, redisClient);
  require('./api/v1')(app, config, authenticator, redisClient);
  require('./api/v1/metrics')(app, config, authenticator, redisClient);

  app.get('/', function (req, res) {
    res.redirect('/account');
  });
};
