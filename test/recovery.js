"use strict"

const Recovery = artifacts.require("Recovery")
const Roles2LibraryInterface = artifacts.require("Roles2LibraryInterface")
const Roles2Library = artifacts.require("StubRoles2Library")
const Storage = artifacts.require("Storage")
const StorageManager = artifacts.require("StorageManager")
const Mock = artifacts.require("Mock")
const UserMock = artifacts.require("UserMock")
const FailedUserMock = artifacts.require("FailedUserMock")

const Reverter = require('./helpers/reverter')
const eventsHelper = require('./helpers/eventsHelper')

contract('Recovery', function(accounts) {
	const reverter = new Reverter(web3)

	const users = {
		contractOwner: accounts[0],
		caller: accounts[1],
		newUser: '0xffffffffffffffffffffffffffffffffffffffff',
		prevUser: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
	}

	const contracts = {
		mock: null,
		userMock: null,
		failedUserMock: null,
		recovery: null,
		rolesLibrary: null,
		roles2LibraryInterface: web3.eth.contract(Roles2LibraryInterface.abi).at('0x0'),
	}

	let snapshotId

	const assertExpectations = async (expected = 0, callsCount = null) => {
		assert.equal(
			(await contracts.mock.expectationsLeft()).toString(16),
			expected.toString(16)
		)

		const expectationsCount = await contracts.mock.expectationsCount()
		assert.equal(
			(await contracts.mock.callsCount()).toString(16),
			callsCount === null ? expectationsCount.toString(16) : callsCount.toString(16)
		)
	}

	before('setup', async () => {
		await reverter.promisifySnapshot()
		snapshotId = reverter.snapshotId

		contracts.storage = await Storage.new({ from: users.contractOwner, })
		contracts.storageManager = await StorageManager.new({ from: users.contractOwner, })
		await contracts.storage.setManager(contracts.storageManager.address, { from: users.contractOwner, })

		contracts.rolesLibrary = await Roles2Library.new(contracts.storage.address, "RolesLib", { from: users.contractOwner, })
		await contracts.storageManager.giveAccess(contracts.rolesLibrary.address, "RolesLib", { from: users.contractOwner, })
		await contracts.rolesLibrary.setRootUser(users.contractOwner, true, { from: users.contractOwner, })

		contracts.recovery = await Recovery.new(contracts.rolesLibrary.address, { from: users.contractOwner, })
		contracts.mock = await Mock.new({ from: users.contractOwner, })
		contracts.userMock = await UserMock.new({ from: users.contractOwner, })
		contracts.failedUserMock = await FailedUserMock.new({ from: users.contractOwner, })

		await contracts.userMock.setContractOwner(users.prevUser)
		await contracts.failedUserMock.setContractOwner(users.prevUser)

		await reverter.promisifySnapshot()
	})

	after(async () => {
		await reverter.promisifyRevert(snapshotId)
	})

	afterEach('revert', async () => {
		await reverter.promisifyRevert()
	})

	it('should check auth on user recovery', async () => {
		await contracts.recovery.setRoles2Library(contracts.mock.address)
		await contracts.mock.expect(
			contracts.recovery.address,
			0,
			contracts.roles2LibraryInterface.canCall.getData(
				users.caller,
				contracts.recovery.address,
				contracts.recovery.contract.recoverUser.getData(0, 0).slice(0, 10)
			),
			0
		)
		await contracts.recovery.recoverUser(contracts.userMock.address, users.newUser, { from: users.caller, })
		await assertExpectations()
	})

	it('should recover users', async () => {
		const tx = await contracts.recovery.recoverUser(contracts.userMock.address, users.newUser)
		{
			const event = (await eventsHelper.findEvent([contracts.recovery,], tx, "UserRecovered"))[0]
			assert.isDefined(event)
			assert.equal(event.args.prevUser, users.prevUser)
			assert.equal(event.args.newUser, users.newUser)
			assert.equal(event.args.userContract, contracts.userMock.address)
			assert.notEqual(event.args.newUser, event.args.prevUser)
		}

		assert.equal((await contracts.userMock.recoverUserCalls.call()).toString(16), '1')
	})

	it('should THROW on user recovery when unable to recover', async () => {
		await contracts.recovery.recoverUser(contracts.failedUserMock.address, users.newUser).then(assert.fail, () => true)
		assert.equal((await contracts.failedUserMock.recoverUserCalls.call()).toString(16), '0')
	})

})
