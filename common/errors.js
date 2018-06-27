const errorScope = {
	roles: 20000,
	userFactory: 21000,
}

const errorCodes = {

	UNAUTHORIZED: 0,
	OK: 1,
	MULTISIG_ADDED: 3,

	ROLES_ALREADY_EXISTS: errorScope.roles + 1,
	ROLES_INVALID_INVOCATION: errorScope.roles + 2,
	ROLES_NOT_FOUND: errorScope.roles + 3,

	USER_FACTORY_INVALID_BACKEND_VERSION: errorScope.userFactory + 1,
}

module.exports = errorCodes
