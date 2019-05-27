module.exports = {
  "ldap": {
    // LDAP Settings
    "server": {
      "uri": process.env.LDAP_URI || "ldap://localhost:3389",
      "baseDn": "dc=openmrs,dc=org",
      "rdn": "cn",
      "loginUser": process.env.LDAP_USER || "admin",
      "password": process.env.LDAP_PASSWORD || "admin"
    },
    "user": {
      "baseDn": "ou=users,dc=openmrs,dc=org",
      "rdn": "uid",
    },
  },
};
