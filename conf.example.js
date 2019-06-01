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
  },
};
