const Storage = artifacts.require('Storage.sol')
const StorageManager = artifacts.require('StorageManager.sol')
const Roles2Library = artifacts.require('Roles2Library.sol')
const UserBackendProvider = artifacts.require('UserBackendProvider.sol')
const UserBackend = artifacts.require('UserBackend.sol')
const UserFactory = artifacts.require('UserFactory.sol')
const UserRegistry = artifacts.require('UserRegistry.sol')
const Recovery = artifacts.require('Recovery.sol')

const ORACLE_ADDRESS = '0xc291ebf9de0bba851f47318ee18ba7a1c71baa29'

const Roles = { USER_REGISTRY_ROLE: 11, }

module.exports = (deployer, network, accounts) => {
	deployer.then(async () => {
		const storageManager = await StorageManager.new()
		await storageManager.setupEventsHistory(storageManager.address)
		console.log(`[StorageManager] address is: ${storageManager.address}`)

		const storage = await Storage.new()
		await storage.setManager(storageManager.address)
		console.log(`[Storage] address is: ${storage.address}`)

		const roles2Library = await Roles2Library.new(storage.address, 'Roles2Library')
		await storageManager.giveAccess(roles2Library.address, 'Roles2Library')
		await roles2Library.setRootUser(accounts[0], true)
		await roles2Library.setupEventsHistory(roles2Library.address)
		console.log(`[Roles2Library] address is: ${roles2Library.address}`)

		const recovery = await Recovery.new(roles2Library.address)
		console.log(`[Recovery] address is: ${recovery.address}`)

		const userBackend = await UserBackend.new()
		console.log(`[UserBackend] address is: ${userBackend.address}`)

		const userRegistry = await UserRegistry.new(storage.address, 'UserRegistry', roles2Library.address)
		await storageManager.giveAccess(userRegistry.address, 'UserRegistry')
		await userRegistry.setupEventsHistory(userRegistry.address)
		console.log(`[UserRegistry] address is: ${userRegistry.address}`)

		const userBackendProvider = await UserBackendProvider.new(roles2Library.address)
		await userBackendProvider.setUserRegistry(userRegistry.address)
		await userBackendProvider.setUserBackend(userBackend.address)
		console.log(`[UserBackendProvider] address is: ${userBackendProvider.address}`)

		const userFactory = await UserFactory.new(roles2Library.address)
		await userFactory.setUserBackendProvider(userBackendProvider.address)
		await userFactory.setOracleAddress(ORACLE_ADDRESS)
		// await userFactory.setUserRecoveryAddress(recovery.address)
		console.log(`[UserFactory] address is: ${userFactory.address}`)

		// NOTE: HERE!!!! RIGHTS SHOULD BE GRANTED TO UserFactory TO ACCESS UserRegistry CONTRACT MODIFICATION
		await roles2Library.addUserRole(userFactory.address, Roles.USER_REGISTRY_ROLE)
		console.log('1')
		const sig = userRegistry.contract.addUserContract.getData(0x0).slice(0, 10)
		console.log('2', sig)
		await roles2Library.addRoleCapability(Roles.USER_REGISTRY_ROLE, userRegistry.address, sig)
		console.log('3')
	})
}