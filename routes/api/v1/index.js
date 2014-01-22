module.exports = function (app, config, passport, redisClient) {
  app.get('/api/v1/puppet/devices/hostname/:hostname'
    , app.locals.requireGroup('users')
    , function (req, res) {
      app.locals.getPuppetDevice(req.params.hostname
        , function (err, device) {
          if (err) {
            res.send(500);
          } else {
            res.type('application/json');
            res.send(JSON.stringify({ aaData: [device] }));
          }
        })
    });

  app.get('/api/v1/puppet/devices/hostname/:hostname/facts'
    , app.locals.requireGroup('users')
    , function (req, res) {
      var request = require('request');
      var hostname = req.params.hostname;
      request({ url: app.get('puppetdb_uri') + '/nodes/' + hostname + '/facts', json: true}
        , function (error, response, body) {
          app.locals.logger.log('debug', 'fetched data from PuppetDB', { uri: app.get('puppetdb_uri') + '/nodes/' + hostname + '/facts'});
          var resBody = JSON.stringify({ aaData: body });
          res.writeHead(200, { 'Content-Length': resBody.length, 'Content-Type': 'application/json' });
          res.write(resBody);
          res.end();
        });
    });

  app.get('/api/v1/sensu/devices/hostname/:hostname'
    , app.locals.requireGroup('users')
    , function (req, res) {
      app.locals.getSensuDevice(req.params.hostname
        , function (err, device) {
          if (err) {
            res.send(500);
          } else {
            res.type('application/json');
            res.send(JSON.stringify({ aaData: [device] }));
          }
        })
    });

  app.get('/api/v1/ubersmith/devices/deviceid/:deviceid/tickets'
    , app.locals.requireGroup('users')
    , function (req, res) {
      app.locals.ubersmith.getTicketsbyDeviceID(req.params.deviceid
      , function (err, ticketList){
          if (ticketList == null)
          {
             res.send(500);
          } else {
            res.type('application/json');
            res.send(JSON.stringify(ticketList));
          }
        });
    });

      app.get('/api/v1/ubersmith/devices/rack/:rack'
    , app.locals.requireGroup('users')
    , function (req, res) {
      app.locals.ubersmith.getDevicesByRack(req.params.rack
        , function (error, device) {
          if (error != null)
          {
            res.send(500);
          } else {
            if (device.dev && device.dev != null)
            {
              res.type('application/json');
              res.send(JSON.stringify({ aaData: [device] }));
            } else {
              res.send(500);
            }
          }
        })
    });

  app.get('/api/v1/ubersmith/devices/hostname/:hostname'
    , app.locals.requireGroup('users')
    , function (req, res) {
      app.locals.ubersmith.getDeviceByHostname(req.params.hostname
        , function (error, device) {
          if (error != null)
          {
            res.send(500);
          } else {
            if (device.dev && device.dev != null)
            {
              res.type('application/json');
              res.send(JSON.stringify({ aaData: [device] }));
            } else {
              res.send(500);
            }
          }
        })
    });

  app.get('/api/v1/ubersmith/devices/deviceid/:deviceid'
    , app.locals.requireGroup('users')
    , function (req, res) {
      app.locals.ubersmith.getDeviceByID(req.params.deviceid
        , function (error, device) {
          if (error != null)
          {
            res.send(500);
          } else {
            if (device.dev && device.dev != null)
            {
              res.type('application/json');
              res.send(JSON.stringify({ aaData: [device] }));
            } else {
              res.send(500);
            }
          }
        })
    });

  app.get('/api/v1/global/devices/deviceid/:deviceid'
    , app.locals.requireGroup('users')
    , function (req, res) {
      app.locals.ubersmith.getDeviceByID(req.params.deviceid
        , function (error, uberDevice) {
          if (error != null)
          {
            app.locals.logger.log('error', 'Failed to retrieve device from Ubersmith', { deviceid: req.params.deviceid });
            res.send(404);
          } else {
            var async = require('async');
            var hostname =  uberDevice.dev_desc + '.contegix.mgmt';
            async.parallel([
              function (asyncCallback) {
                app.locals.getPuppetDevice(hostname, asyncCallback);
              },
              function (asyncCallback) {
                app.locals.getSensuDevice(hostname, asyncCallback);
              }
            ], function(err, results) {
              if (err)
              {
                res.send(500);
              } else {
                if (results && results.length==2)
                {
                  var puppetDevice = results[0];
                  var sensuDevice = results[1];
                  res.type('application/json');
                  res.send(JSON.stringify({ ubersmith: uberDevice, sensu: sensuDevice, puppet: puppetDevice }));
                } else {
                  res.send(500);
                }
              }
            });
          }
        }
      );
    }
  );

  app.get('/api/v1/global/devices/hostname/:hostname'
    , app.locals.requireGroup('users')
    , function (req, res) {
      var async = require('async');
      var hostname =  req.params.hostname;
      async.parallel([
        function (asyncCallback) {
          app.locals.ubersmith.getDeviceByHostname(hostname, function (err, device){
            if (err)
            {
              asyncCallback(null, { error: 'No information is known about ' + hostname, device: {}});
            } else {
              asyncCallback(null, { device: device });
            }
          });
        },
        function (asyncCallback) {
          app.locals.getPuppetDevice(hostname, function (err, device){
            if (err)
            {
              asyncCallback(null, {});
            } else {
              asyncCallback(null, device);
            }
          });
        },
        function (asyncCallback) {
          app.locals.getSensuDevice(hostname, function (err, device){
            if (err)
            {
              asyncCallback(null, {});
            } else {
              asyncCallback(null, device);
            }
          });
        }
      ], function(err, results) {
        if (err)
        {
          res.send(500);
        } else {
          if (results && results.length==3)
          {
            var uberDevice = results[0];
            var puppetDevice = results[1];
            var sensuDevice = results[2];

            res.type('application/json');
            res.send(JSON.stringify({ ubersmith: uberDevice, sensu: sensuDevice, puppet: puppetDevice }));
          } else {
            res.send(500);
          }
        }
      });
    }
  );

  // This function needs to die
  app.get('/api/v1/ubersmith/data/:key'
    , function (req, res) {
      var key = req.params.key;
      switch(key.toLowerCase())
      {
        case 'support.ticket_count.urgent':
        case 'support.ticket_count.normal':
        case 'support.ticket_count.low':
        case 'support.ticket_count.high':
        case 'support.ticket_count.total':
        case 'device.type_list':
        case 'support.ticket_count':
        case 'client.list':
        case 'device.list':
          redisClient.get(key.toLowerCase(), function (err, reply) {
            if (!reply) {
              res.send(500);
            } else {
              res.type('application/json');
              res.send(reply);
            }
          });
          break;
        case 'support.ticket_list':
          redisClient.get(key.toLowerCase(), function (err, reply) {
            if (!reply) {
              res.send(500);
            } else {
              var tickets = Array();
              var ticketList = JSON.parse(reply);
              Object.keys(ticketList).forEach(
                function (ticketID) {
                  var uberTicket = ticketList[ticketID];
                  if (uberTicket.type.indexOf("Closed") == -1)
                  {
                    uberTicket.client_activity = app.locals.getFormattedTimestamp(uberTicket.client_activity)
                    uberTicket.timestamp = app.locals.getFormattedTimestamp(uberTicket.timestamp)
                    uberTicket.activity = app.locals.getFormattedTimestamp(uberTicket.activity)
                    uberTicket.admin_initial_response = app.locals.getFormattedTimestamp(uberTicket.admin_initial_response)
                    var filteredTicket = { priority: uberTicket.priority, type: uberTicket.type, timestamp: uberTicket.timestamp, activity: uberTicket.activity, activity_type: uberTicket.activity_type, client_id: uberTicket.client_id, listed_company: uberTicket.listed_company, q_name: uberTicket.q_name, admin_username: uberTicket.admin_username, subject: uberTicket.subject, device_id: uberTicket.device_id }
                    tickets.push(filteredTicket);
                  }
                });
              res.type('application/json');
              res.send({ aaData: tickets });
            }
          });
          break;
        case 'uber.event_list':
          redisClient.get(key.toLowerCase(), function (err, reply) {
            if (!reply) {
              res.send(500);
            } else {
              var events = Array();
              var eventList = JSON.parse(reply);
              Object.keys(eventList).forEach(
                function (eventID) {
                  var uberEvent = eventList[eventID];
                  uberEvent.time = app.locals.getFormattedTimestamp(uberEvent.time)
                  events.push(uberEvent);
                });
              res.type('application/json');
              res.send({ aaData: events });
            }
          });
          break;
        default:
          res.send(400);
          break;
      }
    });
}