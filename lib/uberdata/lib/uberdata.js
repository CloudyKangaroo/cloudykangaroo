var ubersmith = require('ubersmith');
var redis = require('redis');

var outstandingEvents = 0;
var redisClient;

module.exports = UberData;

/**
 * Uses populateUberData function to request, and schedule refreshes of cached Ubersmith Data
 * @param redisPort
 * @param redisHost
 * @param UberAuth
 * @constructor
 */
function UberData(redisPort, redisHost, UberAuth) {
  redisClient = redis.createClient(redisPort, redisHost);
  ubersmith.uberAuth = UberAuth;
  populateUberData('support.ticket_count', '&priority=0&type=ClientAll', 'support.ticket_count.low');
  populateUberData('support.ticket_count', '&priority=1&type=ClientAll', 'support.ticket_count.normal');
  populateUberData('support.ticket_count', '&priority=2&type=ClientAll', 'support.ticket_count.high');
  populateUberData('support.ticket_count', '&priority=3&type=ClientAll', 'support.ticket_count.urgent');
  populateUberData('support.ticket_count', '&type=ClientAll', 'support.ticket_count.total');

  populateUberData('client.list');
  populateUberData('device.list', '', 'device.list', '30');
  populateUberData('device.type_list');
  populateUberData('event_list');
  populateUberData('support.ticket_list', '', 'support.ticket_list', '60');
  populateUberData('support.ticket_count', '', 'support.ticket_count', '60');
}


/**
 * Used to store data from Ubersmith API in local Redis Cache
 * @param method
 * @param params
 * @param key
 * @param interval
 */
function populateUberData(method, params, key, interval) {
  outstandingEvents++;

  if (arguments.length == 1) {
    var params = '';
    var key = method;
    var interval = 300;
  }

  if (arguments.length == 2) {
    var key = method;
    var interval = 300;
  }

  if (arguments.length == 3) {
    var interval = 300;
  }

  ubersmith.uberRefreshData(method, params, key);
  ubersmith.uberScheduleRefresh(method, interval, params, key);

  ubersmith.on('ready.' + key, function (body, key) {
    storeUberData(body, key)
  });

  ubersmith.on('failed.' + key, function (err) {
     uberError(err)
  });
}

/**
 * Handles Error from Ubersmith Module
 * @param err
 */
function uberError(err) {

  if (outstandingEvents > 0) {
    outstandingEvents--;
  }

  console.log(err);

  if (outstandingEvents == 0 && !exports.done)
  {
    exports.done = true;
    console.log('Uberdata module loaded');
  }
}

/**
 * Handles returned data from Ubersmith Module
 * @param body
 * @param key
 */
function storeUberData(body, key) {
  if (outstandingEvents > 0) {
    outstandingEvents--;
  }

  console.log('Storing ' + JSON.stringify(body.data).length + ' bytes as ' + key);
  redisClient.set(key, JSON.stringify(body.data));

  if (outstandingEvents == 0 && !exports.done)
  {
    exports.done = true;
    console.log('Uberdata module loaded');
  }
  switch (key)
  {
    case 'device.list':
      var deviceList = body.data;
      var deviceListbyCompany = {};
      var deviceListbyClientID = {};
      Object.keys(deviceList).forEach(function(device_id) {
        device = deviceList[device_id];

        if (device.company && device.company != 'null')
        {
          if (!(device.company in deviceListbyCompany))
          {
            deviceListbyCompany[device.company] = Array();
          }
          deviceListbyCompany[device.company].push(device);
        }

        if (device.clientid && device.clientid != 'null')
        {
          if (!(device.clientid in deviceListbyClientID))
          {
            deviceListbyClientID[device.clientid] = Array();
          }
          deviceListbyClientID[device.clientid].push(device);
        }
      });
      redisClient.set('device.list.clientid', JSON.stringify(deviceListbyClientID));
      redisClient.set('device.list.company', JSON.stringify(deviceListbyCompany));
      break;
    default:
      break;
  }
}