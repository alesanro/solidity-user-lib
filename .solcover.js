module.exports = {
	copyNodeModules: true,
	skipFiles: [
		'migration/Migrations.sol',
		'helpers/BumpedUserBackend.sol',
		'helpers/FailedUserMock.sol',
		'helpers/Mock.sol',
		'helpers/StorageManager.sol',
		'helpers/UserMock.sol',
		'helpers/StubRoles2Library.sol',
		'helpers/UserProxyTester.sol',
	]
  }