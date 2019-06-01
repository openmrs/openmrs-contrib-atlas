'use strict';

const ldap = require('ldapjs');
const log = require('log4js').getLogger();

const conf = require('./conf.example.js');
const serverAttr = conf.ldap.server;
const userAttr = conf.ldap.user;


// ldap connection url
const url = serverAttr.uri;

const systemDN = `${serverAttr.rdn}=${serverAttr.loginUser},${serverAttr.baseDn}`;
const bindCredentials = serverAttr.password;

// LDAP client used for general operation
const client = ldap.createClient({
  url: url,
  maxConnections: 10,
  bindDN: systemDN,
  bindCredentials: bindCredentials,
  queueDisable: true, //fail fast when connections times out. https://github.com/mcavage/node-ldapjs/issues/328
  reconnect: { // tries to reconnect if LDAP server is down. https://github.com/mcavage/node-ldapjs/issues/403
    initialDelay: 100,
    maxDelay: 500,
    failAfter: Infinity,
  },
});

/* Public API functions */

/**
 * Authenticates user to LDAP
 * @param  {string}   username  User's username
 * @param  {string}   pass      User's password in cleartext (maybe unsafe)
 * @param  {Function} cb        cb(err)
 */
exports.authenticate = (username, pass, cb) => {
  log.debug(`${username}: will authenticate`);
  // client used for authenticating users specially
  const userClient = ldap.createClient({
    url: url,
  });
  const userdn = `${userAttr.rdn}=${username},${userAttr.baseDn}`;
  console.log(userdn);
  userClient.bind(userdn, pass, err => {
    userClient.unbind();
    return cb(err);
  });
};


/**
 * Get a user's info from LDAP server based on the username
 * @param  {string}   username  User's username
 * @param  {Function} cb        cb(err, user)
 */
exports.getUser = (username, cb) => {
  const base = `uid=${username},${userAttr.baseDn}`;
  const options = {
    scope: 'base',
    attributes: ["uid","cn","sn","displayName","mail"],
  };

  client.search(base, options, (err, res) => {
    if (err) {
      return cb(err);
    }
    const ret = [];
    res.on('searchEntry', entry => {
      ret.push(entry.object);
    });
    res.on('error', err => {
      if (err.code === 32) { // not found, no such dn
        return cb(null, null);
      }
      log.error(`error: ${err.message}`);
      return cb(err);
    });
    res.on('end', result => {
      log.debug(`ldap search ended with status: ${result.status}`);
      if (!ret.length) {
        return cb(null, null);
      } else {
        return cb(null, ret[0]);
      }
    });
  });
};
