module.exports = {
	copyNodeModules: true,
	skipFiles: [
		'migration/Migrations.sol',
		'helpers/Mock.sol',
		'helpers/StorageManager.sol',
		'helpers/StubRoles2Library.sol',
		'helpers/BumpedUserBackend.sol',
	]
  }