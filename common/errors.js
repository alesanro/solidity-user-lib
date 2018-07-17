const errorScope = {
	roles: 20000,
	userFactory: 21000,
	userRegistry: 30000,
}

const errorCodes = {

	UNAUTHORIZED: 0,
	OK: 1,
	MULTISIG_ADDED: 3,

	ROLES_ALREADY_EXISTS: errorScope.roles + 1,
	ROLES_INVALID_INVOCATION: errorScope.roles + 2,
	ROLES_NOT_FOUND: errorScope.roles + 3,

	USER_FACTORY_INVALID_BACKEND_VERSION: errorScope.userFactory + 1,

	USER_REGISTRY_USER_CONTRACT_ALREADY_EXISTS: errorScope.userRegistry + 1,
	USER_REGISTRY_NO_USER_CONTRACT_FOUND: errorScope.userRegistry + 2,
	USER_REGISTRY_CANNOT_CHANGE_TO_THE_SAME_OWNER: errorScope.userRegistry + 3,
}

module.exports = errorCodes
