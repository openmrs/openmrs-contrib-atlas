module.exports = {
  "ldap": {
    // LDAP Settings
    "server": {
      "uri": process.env.LDAP_URI || "ldap://localhost:3389",
      "baseDn": "ou=system,dc=openmrs,dc=org",
      "rdn": "uid",
      "loginUser": process.env.LDAP_USER || "atlas",
      "password": process.env.LDAP_PASSWORD || "atlas"
    },
    "user": {
      "baseDn": "ou=users,dc=openmrs,dc=org",
      "rdn": "uid",
    },
    "group": {
      "baseDn": "ou=groups,dc=openmrs,dc=org",
      "member": "member",
      "rdn": "cn",
    }
  },
  "smtp": {
    "host": process.env.MAIL_HOST || "localhost",
    "port": process.env.MAIL_PORT || 1025,
    "use_authentication": Boolean(process.env.MAIL_AUTH),
    "auth": {
      "user": process.env.MAIL_USER || "postfix_user",
      "pass": process.env.MAIL_PASS || "secret",
    },
    "logger": Boolean(process.env.MAIL_LOGGING), // log to console
    "debug": Boolean(process.env.LOG_SMTP_TRAFFIC) // include SMTP traffic in the logs
  },
};
