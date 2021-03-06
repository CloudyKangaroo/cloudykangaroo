module.exports = function() {
  "use strict";
  var _ = require('underscore');

  var users = [
    { id: '1', username: 'bob', password: 'VnW2bu8miZre', name: 'Bob Smith' },
    { id: '2', username: 'joe', password: 'password', name: 'Joe Davis' },
    { id: '3', username: 'test', password: 'password', name: 'Unit Tests' },
    { id: '40',username: 'jcreasy', password: 'secret', fullname:'Jonathan Creasy','emails':[{'value':'jonathan.creasy@example.org'}],'type':'admin','profile':{'id':'40','login':'jonathan.creasy','access':{'brands':{'1':0},'api':2,'client_billing':'1'},'roles':{'6':{'role_id':'6','name':'DevOps','access':{'client_acctmgmt':'2','client_comments':'2','client_contact_info':'2','client_opportunities':'2','client_quotes':'2','client_quotes_all':'2','client_quotes_approval':'1','client_reports':'2','client_services':'2','cm_reports':'1','config_access':'2','department.1':'2','department.2':'2','department.4':'2','department.5':'2','department.7':'2','devicemgr':'2','dm_reports':'1','global_reports':'1','ordermgr':'2','sales_leads':'2','sales_opportunities':'2','sm_reports':'1'}}},'auth_brands':{'all_brands':'full'},'auth_roles':{'3':{'role_id':'3','name':'Support Engineers','access':{'client_acctmgmt':'2','client_comments':'2','client_contact_info':'2','client_quotes':'1','client_quotes_approval':'2','client_reports':'2','client_services':'2','cm_reports':'1','department.1':'2','department.2':'2','department.3':'2','department.4':'2','department.5':'2','department.7':'2','devicemgr':'2','dm_reports':'1','dm_settings':'2','global_reports':'1','monitor_info':'2','order_queue.4':'2','order_step.1':'2','order_step.19':'2','order_step.2':'2','order_step.3':'2','order_step.4':'2','sales_leads':'2','sales_opportunities':'2','sm_reports':'1'}},'6':{'role_id':'6','name':'DevOps','access':{'client_acctmgmt':'2','client_comments':'2','client_contact_info':'2','client_opportunities':'2','client_quotes':'2','client_quotes_all':'2','client_quotes_approval':'1','client_reports':'2','client_services':'2','cm_reports':'1','config_access':'2','department.1':'2','department.2':'2','department.4':'2','department.5':'2','department.7':'2','devicemgr':'2','dm_reports':'1','global_reports':'1','ordermgr':'2','sales_leads':'2','sales_opportunities':'2','sm_reports':'1'}}},'class_id':'1','active':'1','client_id':null,'contact_id':null,'fullname':'Jonathan Creasy','email':'jonathan.creasy@contegix.com','last_login':'1392653042','password_timeout':'0','password_changed':'0','auth_module_id':'1','password_expired':'0','type':'admin'}}
  ];

  var defaultUser = { id: '0', name: 'Development User', username: 'development.user', type:'admin', emails: [{name: 'primary', value: 'development.user@contegix.com'}], groups: ['users', 'engineers', 'helpdesk', 'sales', 'super']};

  var find = function(id, done) {
    var retUser = null;
    var retError = null;

    for (var i = 0, len = users.length; i < len; i++) {
      var user = users[i];
      if (user.id === id) {
        retUser = _.defaults(user, defaultUser);
        break;
      }
    }

    if (!retUser) {
      retError = {code: 404, message: 'Could not fine user with ID: ' + id};
    }

    return done(retError, retUser);
  };

  var addUser = function(newUser, done) {
    var retUser = null;
    var found = false;

    for (var i = 0, len = users.length; i < len; i++) {
      var user = users[i];
      if (user.id === newUser.id) {
        users[i] = newUser;
        retUser = users[i];
        found = true;
        break;
      }
    }

    if (!found) {
      users.push(newUser);
      retUser = newUser;
    }

    done(null, _.defaults(retUser, defaultUser));
  };

  var syncfindByUsername = function (username) {
    var retUser = null;

    for (var i = 0, len = users.length; i < len; i++) {
      var user = users[i];
      if (user.username === username) {
        retUser = _.defaults(user, defaultUser);
        break;
      }
    }
    return retUser;
  };

  var findByUsername = function(username, done) {
    var retUser = null;

    for (var i = 0, len = users.length; i < len; i++) {
      var user = users[i];
      if (user.username === username) {
        retUser = _.defaults(user, defaultUser);
        break;
      }
    }
    done(null, retUser);
  };

  module.find = find;
  module.addUser = addUser;
  module.syncfindByUsername = syncfindByUsername;
  module.findByUsername = findByUsername;
  return module;
};