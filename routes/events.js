/**
 * Created with JetBrains WebStorm.
 * User: jonathan
 * Date: 14/01/2014
 * Time: 18:25
 * To change this template use File | Settings | File Templates.
 */
module.exports = function (app, config, passport, redisClient) {
  var formidable = require('formidable');

  app.post('/events/ubersmith/event/:event'
    , function(req, res){
      var form = new formidable.IncomingForm;
      var fields = {};

      app.locals.logger.log('debug', 'incoming event', { event: req.params.event, path: req.path })

      form.parse(req, function(err, fields, files){
        if (err) {
          app.locals.logger.log('error', 'could not process incoming event', { error: err, event: req.params.event, path: req.path });
          res.send(500);
        }
	      app.locals.logger.log('debug', 'parsing form', { fields: fields, files: files, event: req.params.event });
      });

      form.on('field', function(name, value) {
        app.locals.logger.log('debug', 'event field received', { field: name, event: req.params.event, value: value });
        fields[name] = value;
      });

      form.on('progress', function(bytesReceived, bytesExpected) {
        app.locals.logger.log('debug', 'incoming form data', { bytesReceived: bytesReceived, bytesExpected: bytesExpected });
      });

      form.on('error', function(err) {
        app.locals.logger.log('error', 'could not process incoming event', { error: err, event: req.params.event, path: req.path });
        res.send(500);
      });

      form.on('end', function() {
        app.locals.logger.log('debug', 'event complete', { event: req.params.event, fields: fields});
        var ctxlog = require('../../ctxlog');
        var auditLog = ctxlog('audit', 'info');
        auditLog.log('info', req.path, { event: req.params.event, fields: fields})
        // 202 Accepted
        res.send(202);
      });
    });
}
