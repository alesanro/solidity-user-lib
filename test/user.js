"use strict"

const UserBackend = artifacts.require("UserBackend")
const UserRegistry = artifacts.require("UserRegistry")
const UserBackendProvider = artifacts.require("UserBackendProvider")
const BumpedUserBackend = artifacts.require("BumpedUserBackend")
const UserRouter = artifacts.require("UserRouter")
const UserProxy = artifacts.require("UserProxy")
const UserFactory = artifacts.require("UserFactory")
const UserInterface = artifacts.require("UserInterface")
const Roles2Library = artifacts.require("Roles2Library")
const Storage = artifacts.require("Storage")
const StorageManager = artifacts.require("StorageManager")
const Owned = artifacts.require("Owned")
const Mock = artifacts.require("Mock")
const FakeContractInterface = artifacts.require("FakeContractInterface")

const Reverter = require("./helpers/reverter")
const ErrorScope = require("../common/errors")
const eventHelpers = require("./helpers/eventsHelper")
const utils = require("./helpers/utils")
const web3Utils = require("web3-utils")
const Web3Accounts = require("web3-eth-accounts")
const BytesChecker = require('./helpers/bytes-checker')

async function setupUserWorkflow({ users, }) {
	const contracts = {
		storage: null,
		storageManager: null,
		userBackend: null,
		userRegistry: null,
		userBackendProvider: null,
		userFactory: null,
		rolesLibrary: null,
		mock: null,
	}

	contracts.storage = await Storage.new({ from: users.contractOwner, })
	contracts.storageManager = await StorageManager.new({ from: users.contractOwner, })
	await contracts.storageManager.setupEventsHistory(contracts.storageManager.address, { from: users.contractOwner, })
	await contracts.storage.setManager(contracts.storageManager.address, { from: users.contractOwner, })

	contracts.userBackend = await UserBackend.new({ from: users.contractOwner, })

	contracts.rolesLibrary = await Roles2Library.new(contracts.storage.address, "RolesLib", { from: users.contractOwner, })
	await contracts.storageManager.giveAccess(contracts.rolesLibrary.address, "RolesLib", { from: users.contractOwner, })
	await contracts.rolesLibrary.setRootUser(users.contractOwner, true, { from: users.contractOwner, })
	await contracts.rolesLibrary.setupEventsHistory(contracts.rolesLibrary.address, { from: users.contractOwner, })

	contracts.userRegistry = await UserRegistry.new(contracts.storage.address, "UserRegistry", contracts.rolesLibrary.address, { from: users.contractOwner, })
	await contracts.storageManager.giveAccess(contracts.userRegistry.address, "UserRegistry", { from: users.contractOwner, })
	await contracts.userRegistry.setupEventsHistory(contracts.userRegistry.address, { from: users.contractOwner, })

	contracts.userBackendProvider = await UserBackendProvider.new(contracts.rolesLibrary.address, { from: users.contractOwner, })
	await contracts.userBackendProvider.setUserBackend(contracts.userBackend.address, { from: users.contractOwner, })
	await contracts.userBackendProvider.setUserRegistry(contracts.userRegistry.address, { from: users.contractOwner, })

	contracts.userFactory = await UserFactory.new(contracts.rolesLibrary.address, { from: users.contractOwner, })
	await contracts.userFactory.setUserBackendProvider(contracts.userBackendProvider.address, { from: users.contractOwner, })
	await contracts.userFactory.setOracleAddress(users.oracle, { from: users.contractOwner, })
	await contracts.userFactory.setUserRecoveryAddress(users.recovery, { from: users.contractOwner, })

	contracts.mock = await Mock.new()

	// NOTE: HERE!!!! RIGHTS SHOULD BE GRANTED TO UserFactory TO ACCESS UserRegistry CONTRACT MODIFICATION
	{
		const Roles = { USER_REGISTRY_ROLE: 11, }

		await contracts.rolesLibrary.addUserRole(contracts.userFactory.address, Roles.USER_REGISTRY_ROLE, { from: users.contractOwner, })
		{
			const sig = contracts.userRegistry.contract.addUserContract.getData(0x0).slice(0,10)
			await contracts.rolesLibrary.addRoleCapability(Roles.USER_REGISTRY_ROLE, contracts.userRegistry.address, sig, { from: users.contractOwner, })
		}
	}

	return contracts
}

function getUsers(accounts) {
	const users = {
		contractOwner: accounts[0],
		user1: accounts[1],
		user2: accounts[2],
		user3: accounts[3],
		oracle: accounts[6],
		recovery: accounts[7],
		remoteOwner1: accounts[8],
		remoteOwner2: accounts[9],
	}

	const privateKeys = {
		[users.user1]: "0x2ed950bc0ff7fc1f62aa3b302437de9763d81dcde4ce58291756f84748d98ce9",
		[users.user2]: "0xdaeb307eb13b4717d01d9f175ea3ed94374da8fefa52082379d2955579ce628a",
		[users.oracle]: "0x46e5df8a291ff9112503a1007b0288f44132e4542397b4ca6415094393ef7cb9",
	}

	return {
		users: users,
		privateKeys: privateKeys,
	}
}

function CustomAsserts(contracts) {
	this.assertExpectations = async (expected = 0, callsCount = null) => {
		assert.equal(
			(await contracts.mock.expectationsLeft()).toString(16),
			expected.toString(16),
			"Expectations left should be equal to provided one"
		)

		const expectationsCount = await contracts.mock.expectationsCount()
		assert.equal(
			(await contracts.mock.callsCount()).toString(16),
			callsCount === null ? expectationsCount.toString(16) : callsCount.toString(16),
			"Calls count should be equal to provided or expectations count"
		)
	}

	this.assertNoMultisigPresence = async tx => {
		const notEmittedEvents = [
			"Confirmation",
			"Submission",
			"Execution",
		]
		const events = await eventHelpers.findEvents([contracts.userBackend,], tx, e => notEmittedEvents.indexOf(e) >= 0)
		assert.lengthOf(events, 0, "No multisig signs should be found")
	}

	/// @return transactionId
	this.assertMultisigSubmitPresence = async ({ tx, userProxy, user, }) => {
		let transactionId
		{
			const notEmittedEvents = [
				"Execution",
				"Forwarded",
			]
			const events = await eventHelpers.findEvents([ userProxy, contracts.userBackend, ], tx, e => notEmittedEvents.indexOf(e) >= 0)
			assert.lengthOf(events, 0, `No multisig events ${notEmittedEvents} should be found`)
		}
		{
			{
				const event = (await eventHelpers.findEvent([contracts.userBackend,], tx, "Submission"))[0]
				assert.isDefined(event, "No 'Submission' event found")
				assert.isDefined(event.args.transactionId, "Invalid transaction id")

				transactionId = event.args.transactionId
			}
			{
				const event = (await eventHelpers.findEvent([contracts.userBackend,], tx, "Confirmation"))[0]
				assert.isDefined(event, "No 'Confirmation' event found")
				assert.equal(event.args.sender, user, "Signer is not equal to 'sender' from event")
				assert.equal(event.args.transactionId.toString(16), transactionId.toString(16), "Transaction id is not equal to expected from event")
			}
		}

		return transactionId
	}

	this.assertMultisigExecutionPresence = async ({
		tx, transactionId, userRouter, oracle,
	}) => {
		{
			const notEmittedEvents = [
				"Submission",
			]
			const events = await eventHelpers.findEvents([ userRouter, contracts.userBackend, ], tx, e => notEmittedEvents.indexOf(e) >= 0)
			assert.lengthOf(events, 0, `No multisig events ${notEmittedEvents} should be found`)
		}
		{
			{
				const event = (await eventHelpers.findEvent([contracts.userBackend,], tx, "Confirmation"))[0]
				assert.isDefined(event, "No 'Confirmation' event found")
				assert.equal(event.args.sender, oracle, "Oracle should be a sender from event")
				assert.equal(event.args.transactionId.toString(16), transactionId.toString(16), "Transaction id is not equal to expected from event")
			}
			{
				const event = (await eventHelpers.findEvent([contracts.userBackend,], tx, "Execution"))[0]
				assert.isDefined(event, "No 'Execution' event found")
				assert.equal(event.args.transactionId.toString(16), transactionId.toString(16), "Transaction id is not equal to expected from event")
			}
		}
	}

	this.assertMultisigExecutionFailure = async ({
		tx, transactionId, userRouter, oracle,
	}) => {
		{
			const notEmittedEvents = [
				"Submission",
				"Execution",
			]
			const events = await eventHelpers.findEvents([ userRouter, contracts.userBackend, ], tx, e => notEmittedEvents.indexOf(e) >= 0)
			assert.lengthOf(events, 0, `No multisig events ${notEmittedEvents} should be found`)
		}
		{
			{
				const event = (await eventHelpers.findEvent([contracts.userBackend,], tx, "Confirmation"))[0]
				assert.isDefined(event, "No 'Confirmation' event found")
				assert.equal(event.args.sender, oracle, "Oracle should be a sender from event")
				assert.equal(event.args.transactionId.toString(16), transactionId.toString(16), "Transaction id is not equal to expected from event")
			}
			{
				const event = (await eventHelpers.findEvent([contracts.userBackend,], tx, "ExecutionFailure"))[0]
				assert.isDefined(event, "No 'Execution' event found")
				assert.equal(event.args.transactionId.toString(16), transactionId.toString(16), "Transaction id is not equal to expected from event")
			}
		}
	}
}

function MessageComposer(web3, privateKeys) {

	const web3Accounts = new Web3Accounts(web3.currentProvider.address)

	this.signMessage = ({ message, oracle, }) => {
		return web3Accounts.sign(message, privateKeys[oracle])
	}

	this.composeForwardMessageFrom = ({
		pass, sender, destination, data, value,
	}) => {
		return web3Utils.soliditySha3({
			type: "bytes",
			value: pass,
		}, {
			type: "address",
			value: sender,
		}, {
			type: "address",
			value: destination,
		}, {
			type: "bytes",
			value: data,
		}, {
			type: "uint256",
			value: value,
		})
	}
}

function AsyncWeb3(web3) {
	const self = this

	this.getEthBalance = addr => new Promise((resolve, reject) => {
		web3.eth.getBalance(addr, (e, b) => (e === undefined || e === null) ? resolve(b) : reject(e))
	})

	this.getTx = hash => new Promise((resolve, reject) => {
		web3.eth.getTransaction(hash, (e, tx) => (e === undefined || e === null) ? resolve(tx) : reject(e))
	})

	this.getTxReceipt = hash => new Promise((resolve, reject) => {
		web3.eth.getTransactionReceipt(hash, (e, tx) => (e === undefined || e === null) ? resolve(tx) : reject(e))
	})

	this.getTxExpences = async hash => {
		const fullTx = await self.getTx(hash)
		const receiptTx = await self.getTxReceipt(hash)

		return web3.toBigNumber(fullTx.gasPrice).mul(web3.toBigNumber(receiptTx.gasUsed))
	}

	this.sendEth = async ({ from, to, value, }) => {
		return new Promise((resolve, reject) => {
			web3.eth.sendTransaction({ from: from, to: to, value: value, }, (e, txHash) => (e === undefined || e === null) ? resolve(txHash) : reject(e))
		})
	}
}

contract("User Workflow", accounts => {
	const reverter = new Reverter(web3)
	const { users, privateKeys, } = getUsers(accounts)
	const messageComposer = new MessageComposer(web3, privateKeys)

	let contracts
	let customAsserts

	before("setup", async () => {
		await reverter.promisifySnapshot()

		contracts = await setupUserWorkflow({ users, })
		customAsserts = new CustomAsserts(contracts)

		await reverter.promisifySnapshot()
	})

	after(async () => {
		await reverter.promisifyRevert(0)
	})

	context("initial state of", () => {

		describe("user factory", () => {

			afterEach(async () => {
				await reverter.promisifyRevert()
			})

			it("should have pre-setup oracle", async () => {
				assert.equal(
					await contracts.userFactory.oracle(),
					users.oracle
				)
			})

			it("should have pre-setup backend provider", async () => {
				assert.equal(
					await contracts.userFactory.userBackendProvider(),
					contracts.userBackendProvider.address
				)
			})

			it("should have pre-setup recovery address", async () => {
				assert.equal(
					await contracts.userFactory.userRecoveryAddress(),
					users.recovery
				)
			})

			it("should have pre-setup events history", async () => {
				assert.equal(
					await contracts.userFactory.getEventsHistory(),
					contracts.userFactory.address
				)
			})

			it("should THROW and NOT allow to pass 0x0 for events history", async () => {
				await contracts.userFactory.setupEventsHistory(utils.zeroAddress, { from: users.contractOwner, }).then(assert.fail, () => true)
			})

			it("should check auth when setup events history", async () => {
				const caller = users.user3
				const newEventsHistory = "0x0000ffffffffffffffffffffffffffffffff0000"

				await contracts.userFactory.setRoles2Library(contracts.mock.address)
				await contracts.mock.expect(
					contracts.userFactory.address,
					0,
					contracts.rolesLibrary.contract.canCall.getData(caller, contracts.userFactory.address, contracts.userFactory.contract.setupEventsHistory.getData(0x0).slice(0, 10)),
					await contracts.mock.convertUIntToBytes32(1)
				)

				assert.equal(
					(await contracts.userFactory.setupEventsHistory.call(newEventsHistory, { from: caller, })).toNumber(),
					ErrorScope.OK
				)

				await contracts.userFactory.setupEventsHistory(newEventsHistory, { from: caller, })
				await customAsserts.assertExpectations()

				assert.equal(
					await contracts.userFactory.getEventsHistory.call(),
					newEventsHistory
				)
			})

			it("should THROW and NOT allow to pass 0x0 for oracle address", async () => {
				await contracts.userFactory.setOracleAddress(utils.zeroAddress, { from: users.contractOwner, }).then(assert.fail, () => true)
			})

			it("should check auth when set oracle address", async () => {
				const caller = users.user3
				const newOracleAddress = "0x0000ffffffffffffffffffffffffffffffff0000"

				await contracts.userFactory.setRoles2Library(contracts.mock.address)
				await contracts.mock.expect(
					contracts.userFactory.address,
					0,
					contracts.rolesLibrary.contract.canCall.getData(caller, contracts.userFactory.address, contracts.userFactory.contract.setOracleAddress.getData(0x0).slice(0, 10)),
					await contracts.mock.convertUIntToBytes32(1)
				)

				assert.equal(
					(await contracts.userFactory.setOracleAddress.call(newOracleAddress, { from: caller, })).toNumber(),
					ErrorScope.OK
				)

				await contracts.userFactory.setOracleAddress(newOracleAddress, { from: caller, })
				await customAsserts.assertExpectations()

				assert.equal(
					await contracts.userFactory.oracle.call(),
					newOracleAddress
				)
			})

			it("should check auth when set user recovery address", async () => {
				const caller = users.user3
				const newUserRecoveryAddress = "0x0000ffffffffffffffffffffffffffffffff0000"

				await contracts.userFactory.setRoles2Library(contracts.mock.address)
				await contracts.mock.expect(
					contracts.userFactory.address,
					0,
					contracts.rolesLibrary.contract.canCall.getData(caller, contracts.userFactory.address, contracts.userFactory.contract.setUserRecoveryAddress.getData(0x0).slice(0, 10)),
					await contracts.mock.convertUIntToBytes32(1)
				)

				assert.equal(
					(await contracts.userFactory.setUserRecoveryAddress.call(newUserRecoveryAddress, { from: caller, })).toNumber(),
					ErrorScope.OK
				)

				await contracts.userFactory.setUserRecoveryAddress(newUserRecoveryAddress, { from: caller, })
				await customAsserts.assertExpectations()

				assert.equal(
					await contracts.userFactory.userRecoveryAddress.call(),
					newUserRecoveryAddress
				)
			})

			it("should allow to pass 0x0 for user recovery address address", async () => {
				await contracts.userFactory.setUserRecoveryAddress(utils.zeroAddress, { from: users.contractOwner, })
				assert.equal(
					await contracts.userFactory.userRecoveryAddress.call(),
					utils.zeroAddress
				)
			})
		})

		describe("user backend", () => {

			after(async () => {
				await reverter.promisifyRevert()
			})

			it("should THROW and NOT allow to initialize UserBackend by direct call", async () => {
				await contracts.userBackend.init(users.oracle, false, { from: users.contractOwner, }).then(assert.fail, () => true)
			})

			it("should have 0x0 user proxy property", async () => {
				assert.equal(
					await contracts.userBackend.getUserProxy(),
					utils.zeroAddress
				)
			})

			it("should have a contract owner", async () => {
				assert.equal(
					await contracts.userBackend.contractOwner(),
					users.contractOwner
				)
			})

			it("should have default values for other fields", async () => {
				assert.isFalse(await contracts.userBackend.use2FA.call())
				assert.equal(await contracts.userBackend.backendProvider.call(), utils.zeroAddress)
				assert.equal(await contracts.userBackend.issuer.call(), utils.zeroAddress)
				assert.equal(await contracts.userBackend.getUserProxy.call(), utils.zeroAddress)
			})

			it("should THROW on updating user proxy", async () => {
				const userProxy = "0xffffffffffffffffffffffffffffffffffffffff"
				await contracts.userBackend.setUserProxy(userProxy, { from: users.contractOwner, }).then(assert.fail, () => true)
			})

			it("should THROW on updating oracle", async () => {
				const oracle = "0xffffffffffffffffffffffffffffffffffffffff"
				await contracts.userBackend.setOracle(oracle, { from: users.contractOwner, }).then(assert.fail, () => true)
			})

			it("should THROW on updating recovery", async () => {
				const recovery = "0xffffffffffffffffffffffffffffffffffffffff"
				await contracts.userBackend.setRecoveryContract(recovery, { from: users.contractOwner, }).then(assert.fail, () => true)
			})

			it("should THROW on trying to recover a user", async () => {
				await contracts.userBackend.recoverUser(users.user2, { from: users.recovery, }).then(assert.fail, () => true)
			})

			it("should THROW on getting oracle", async () => {
				await contracts.userBackend.getOracle.call().then(assert.fail, () => true)
			})

			it("should THROW on updating 2FA flag", async () => {
				await contracts.userBackend.set2FA(true, { from: users.contractOwner, }).then(assert.fail, () => true)
			})

			it("should THROW on updating backend", async () => {
				const newBackend = "0xffffffffffffffffffffffffffffffffffffffff"
				await contracts.userBackend.updateBackendProvider(newBackend, { from: users.contractOwner, }).then(assert.fail, () => true)
			})

			it("should be able to transfer contract ownership", async () => {
				const newOwner = users.user3
				await contracts.userBackend.transferOwnership(newOwner, { from: users.contractOwner, })
				assert.equal(await contracts.userBackend.contractOwner.call(), newOwner)

				await reverter.promisifyRevert()
			})

			it("should be able to change&claim contract ownership", async () => {
				const newOwner = users.user3
				await contracts.userBackend.changeContractOwnership(newOwner, { from: users.contractOwner, })
				assert.isTrue((await contracts.userBackend.claimContractOwnership.call({ from: newOwner, })))

				await contracts.userBackend.claimContractOwnership({ from: newOwner, })
				assert.equal(await contracts.userBackend.contractOwner.call(), newOwner)

				await reverter.promisifyRevert()
			})
		})

		describe("user registry", () => {

			after(async () => {
				await reverter.promisifyRevert()
			})

			it("should have set up events history", async () => {
				assert.notEqual(await contracts.userRegistry.getEventsHistory(), utils.zeroAddress)
			})
		})

		describe("user backend provider", () => {

			afterEach(async () => {
				await reverter.promisifyRevert()
			})

			it("should have non-null userBackend value", async () => {
				assert.notEqual(
					await contracts.userBackendProvider.getUserBackend.call(),
					utils.zeroAddress
				)
			})

			it("should protect setUserBackend by auth", async () => {
				const caller = users.user3
				const newUserBackend = "0x0000ffffffffffffffffffffffffffffffff0000"

				await contracts.userBackendProvider.setRoles2Library(contracts.mock.address)
				await contracts.mock.expect(
					contracts.userBackendProvider.address,
					0,
					contracts.rolesLibrary.contract.canCall.getData(caller, contracts.userBackendProvider.address, contracts.userBackendProvider.contract.setUserBackend.getData(0x0).slice(0, 10)),
					await contracts.mock.convertUIntToBytes32(1)
				)

				assert.equal(
					(await contracts.userBackendProvider.setUserBackend.call(newUserBackend, { from: caller, })).toNumber(),
					ErrorScope.OK
				)

				await contracts.userBackendProvider.setUserBackend(newUserBackend, { from: caller, })
				await customAsserts.assertExpectations()

				assert.equal(
					await contracts.userBackendProvider.getUserBackend.call(),
					newUserBackend
				)
			})

			it("should THROW and NOT allow to set 0x0 to userBackend", async () => {
				await contracts.userBackendProvider.setUserBackend(utils.zeroAddress, { from: users.contractOwner, }).then(assert.fail, () => true)
			})

			it("should have non-null user registry value", async () => {
				assert.notEqual(
					await contracts.userBackendProvider.getUserRegistry.call(),
					utils.zeroAddress
				)
			})

			it("should protect setUserRegistry by auth", async () => {
				const caller = users.user3
				const newUserRegistry = "0x0000ffffffffffffffffffffffffffffffff0000"

				await contracts.userBackendProvider.setRoles2Library(contracts.mock.address)
				await contracts.mock.expect(
					contracts.userBackendProvider.address,
					0,
					contracts.rolesLibrary.contract.canCall.getData(caller, contracts.userBackendProvider.address, contracts.userBackendProvider.contract.setUserRegistry.getData(0x0).slice(0, 10)),
					await contracts.mock.convertUIntToBytes32(1)
				)

				assert.equal(
					(await contracts.userBackendProvider.setUserRegistry.call(newUserRegistry, { from: caller, })).toNumber(),
					ErrorScope.OK
				)

				await contracts.userBackendProvider.setUserRegistry(newUserRegistry, { from: caller, })
				await customAsserts.assertExpectations()

				assert.equal(
					await contracts.userBackendProvider.getUserRegistry.call(),
					newUserRegistry
				)
			})

			it("should allow to set 0x0 to user registry", async () => {
				await contracts.userBackendProvider.setUserRegistry(utils.zeroAddress, { from: users.contractOwner, })
				assert.equal(
					await contracts.userBackendProvider.getUserRegistry.call(),
					utils.zeroAddress
				)
			})
		})

	})

	context("creation", () => {
		const user = users.user1

		let userRouterAddress
		let userProxyAddress
		let snapshotId

		before(async () => {
			snapshotId = reverter.snapshotId
		})

		after(async () => {
			await reverter.promisifyRevert(snapshotId)
		})

		it("should THROW and NOT allow to set 2FA for a user without proper init (calling 'init' function)", async () => {
			const stubUser = await UserRouter.new(user, users.recovery, contracts.userBackendProvider.address, { from: users.contractOwner, })
			await UserInterface.at(stubUser.address).set2FA(true, { from: user, }).then(assert.fail, () => true)
		})

		it("should NOT allow to init a created user by a non-issuer with UNAUTHORIZED code", async () => {
			const issuer = users.user3
			const nonIssuer = users.user2
			const stubUser = await UserRouter.new(user, users.recovery, contracts.userBackendProvider.address, { from: issuer, })
			assert.equal(
				(await UserInterface.at(stubUser.address).init.call(users.oracle, true, { from: nonIssuer, })).toNumber(),
				ErrorScope.UNAUTHORIZED
			)

			await UserInterface.at(stubUser.address).init(users.oracle, true, { from: nonIssuer, })
			await UserInterface.at(stubUser.address).getOracle().then(assert.fail, () => true)
			assert.isFalse(await UserInterface.at(stubUser.address).use2FA.call())
		})

		it("should allow to create a user with manual init by issuer", async () => {
			const issuer = users.user3
			const stubUser = await UserRouter.new(user, users.recovery, contracts.userBackendProvider.address, { from: issuer, })
			assert.equal(
				(await UserInterface.at(stubUser.address).init.call(users.oracle, true, { from: issuer, })).toNumber(),
				ErrorScope.OK
			)

			await UserInterface.at(stubUser.address).init(users.oracle, true, { from: issuer, })
			assert.equal(
				await UserInterface.at(stubUser.address).getOracle.call(),
				users.oracle
			)
			assert.isTrue(await UserInterface.at(stubUser.address).use2FA.call())
		})

		it("should THROW and NOT allow to create a user without an owner", async () => {
			await contracts.userFactory.createUserWithProxyAndRecovery(utils.zeroAddress, false, { from: user, }).then(assert.fail, () => true)
		})

		it("should THROW and NOT allow to create a user without backend provider", async () => {
			await UserRouter.new(user, users.recovery, utils.zeroAddress, { from: users.contractOwner, }).then(assert.fail, () => true)
		})

		it("should THROW and NOT allow to pass 0x0 to update a user backend provider", async () => {
			const issuer = users.contractOwner
			const stubUser = await UserRouter.new(user, users.recovery, contracts.userBackendProvider.address, { from: issuer, })
			await UserInterface.at(stubUser.address).updateBackendProvider(utils.zeroAddress, { from: issuer, }).then(assert.fail, () => true)
		})

		it("should be able to create a new user", async () => {
			const tx = await contracts.userFactory.createUserWithProxyAndRecovery(user, false, { from: user, })
			{
				const event = (await eventHelpers.findEvent([contracts.userFactory,], tx, "UserCreated"))[0]
				assert.isDefined(event)
				assert.isDefined(event.args.user)
				assert.isDefined(event.args.proxy)
				assert.equal(event.args.recoveryContract, users.recovery)
				assert.equal(event.args.owner, user)

				userRouterAddress = event.args.user
				userProxyAddress = event.args.proxy
			}
			{
				const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "UserContractAdded"))[0]
				assert.isDefined(event)
				assert.equal(event.args.userContract, userRouterAddress)
			}
		})

		it("should be able to create a new user with no set up user registry", async () => {
			await reverter.promisifySnapshot()
			const snapshotId = reverter.snapshotId

			await contracts.userBackendProvider.setUserRegistry(0x0, { from: users.contractOwner, })
			const tx = await contracts.userFactory.createUserWithProxyAndRecovery(user, false, { from: user, })
			{
				const event = (await eventHelpers.findEvent([contracts.userFactory,], tx, "UserCreated"))[0]
				assert.isDefined(event)
				assert.isDefined(event.args.user)
				assert.isDefined(event.args.proxy)
				assert.equal(event.args.recoveryContract, users.recovery)
				assert.equal(event.args.owner, user)
			}
			{
				const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "UserContractAdded"))[0]
				assert.isUndefined(event)
			}

			await reverter.promisifyRevert(snapshotId)
		})

		it("should have correct contract owner for a user", async () => {
			assert.equal(
				user,
				await Owned.at(userRouterAddress).contractOwner.call()
			)
		})

		it("should have correct user proxy address", async () => {
			assert.equal(
				userProxyAddress,
				await UserInterface.at(userRouterAddress).getUserProxy.call()
			)
		})

		it("should have user contract be registered in UserRegistry", async () => {
			assert.include(await contracts.userRegistry.getUserContracts(user), userRouterAddress)
		})

		it("should NOT allow to initialize newly created user from UserFactory with UNAUTHORIZED code", async () => {
			assert.equal(
				(await UserInterface.at(userRouterAddress).init.call(users.oracle, false, { from: user, })).toNumber(),
				ErrorScope.UNAUTHORIZED
			)
		})

		it("user should have issuer and backend", async () => {
			assert.equal(
				(await UserRouter.at(userRouterAddress).backendProvider.call()),
				contracts.userBackendProvider.address
			)
			assert.equal(
				(await UserRouter.at(userRouterAddress).issuer.call()),
				contracts.userFactory.address
			)
		})

		it("user should have disabled 2FA by default", async () => {
			assert.equal(
				(await UserRouter.at(userRouterAddress).use2FA.call()),
				false
			)
		})

		it("user should be able to forward a call by a user", async () => {
			const data = contracts.userFactory.contract.createUserWithProxyAndRecovery.getData(user, false)
			await contracts.mock.expect(
				userProxyAddress,
				0,
				data,
				await contracts.mock.convertUIntToBytes32.call(ErrorScope.OK)
			)

			await UserInterface.at(userRouterAddress).forward(contracts.mock.address, data, 0, true, { from: user, }).then(() => true, assert.fail)
			await customAsserts.assertExpectations()
		})

		it("anyone should NOT be able to update recovery contract with UNAUTHORIZED code", async () => {
			const newRecovery = users.user3
			assert.equal(
				(await UserInterface.at(userRouterAddress).setRecoveryContract.call(newRecovery, { from: users.user3, })).toNumber(),
				ErrorScope.UNAUTHORIZED
			)
		})

		it("should THROW when pass 0x0 for recovery contract", async () => {
			await UserInterface.at(userRouterAddress).setRecoveryContract(utils.zeroAddress, { from: user, }).then(assert.fail, () => true)
		})

		it("user should be able to update recovery contract with OK code", async () => {
			const newRecovery = users.user3
			assert.equal(
				(await UserInterface.at(userRouterAddress).setRecoveryContract.call(newRecovery, { from: user, })).toNumber(),
				ErrorScope.OK
			)
		})

		const newRecovery = users.user3

		it("user should be able to recover with OK code", async () => {
			const oldRecovery = users.recovery
			const newUser = users.user2
			await UserInterface.at(userRouterAddress).setRecoveryContract(newRecovery, { from: user, })

			assert.equal(
				(await UserInterface.at(userRouterAddress).recoverUser.call(newUser, { from: oldRecovery, })).toNumber(),
				ErrorScope.UNAUTHORIZED
			)
			assert.equal(
				(await UserInterface.at(userRouterAddress).recoverUser.call(newUser, { from: newRecovery, })).toNumber(),
				ErrorScope.OK
			)
		})

		it("should THROW when pass 0x0 for a new user during recovery", async () => {
			await UserInterface.at(userRouterAddress).recoverUser(utils.zeroAddress, { from: newRecovery, }).then(assert.fail, () => true)
		})

		it("user should be able to recover", async () => {
			await reverter.promisifySnapshot()
			const snapshotId = reverter.snapshotId

			const newUser = users.user2
			const tx = await UserInterface.at(userRouterAddress).recoverUser(newUser, { from: newRecovery, })
			assert.equal(await Owned.at(userRouterAddress).contractOwner.call(), newUser)
			assert.isTrue(await UserInterface.at(userRouterAddress).isOwner(newUser), "current contract owner should be in multisig")
			assert.isFalse(await UserInterface.at(userRouterAddress).isOwner(user), "previous contract owner should not be in multisig")
			console.log(`#### ${await contracts.userBackendProvider.getUserRegistry()}`)
			assert.notInclude(await contracts.userRegistry.getUserContracts(user), userRouterAddress)
			assert.include(await contracts.userRegistry.getUserContracts(newUser), userRouterAddress)
			{
				const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "UserContractChanged"))[0]
				assert.isDefined(event)
				assert.equal(event.args.userContract, userRouterAddress)
				assert.equal(event.args.oldOwner, user)
				assert.equal(event.args.owner, newUser)
			}

			await reverter.promisifyRevert(snapshotId)
		})

		it("anyone should NOT be able to update an oracle with UNAUTHORIZED code", async () => {
			const newOracle = users.user3
			assert.equal(
				(await UserInterface.at(userRouterAddress).setOracle.call(newOracle, { from: users.user3, })).toNumber(),
				ErrorScope.UNAUTHORIZED
			)
		})

		it("should THROW when pass 0x0 oracle", async () => {
			await UserInterface.at(userRouterAddress).setOracle(utils.zeroAddress, { from: user, }).then(assert.fail, () => true)
		})

		it("user should be able to update an oracle with OK code", async () => {
			const newOracle = users.user3
			assert.equal(
				(await UserInterface.at(userRouterAddress).setOracle.call(newOracle, { from: user, })).toNumber(),
				ErrorScope.OK
			)
		})

		it("user should be able to update an oracle", async () => {
			const newOracle = users.user3
			await UserInterface.at(userRouterAddress).setOracle(newOracle, { from: user, })

			assert.equal(
				await UserInterface.at(userRouterAddress).getOracle.call(),
				newOracle
			)
		})

		const newUser = users.user2

		it("a new owner should not be a multisig owner", async () => {
			assert.isTrue(await UserInterface.at(userRouterAddress).isOwner(user))
			assert.isFalse(await UserInterface.at(userRouterAddress).isOwner(newUser))
		})

		it("should NOT allow to transfer a contract ownership to another user by non-contract owner", async () => {
			assert.notEqual(await Owned.at(userRouterAddress).contractOwner.call(), newUser)
			assert.isFalse(await Owned.at(userRouterAddress).transferOwnership.call(newUser, { from: newUser, }))
		})

		it("should be able to transfer a contract ownership to another user", async () => {
			assert.notEqual(await Owned.at(userRouterAddress).contractOwner.call(), newUser)

			await Owned.at(userRouterAddress).transferOwnership(newUser, { from: user, })
			assert.equal(await Owned.at(userRouterAddress).contractOwner.call(), newUser)
		})

		it("multisig owner should change with ownership transfer", async () => {
			assert.isTrue(await UserInterface.at(userRouterAddress).isOwner(newUser), "new contract owner should be in multisig")
			assert.isFalse(await UserInterface.at(userRouterAddress).isOwner(user), "old contract owner should not be in multisig")
		})

		it("should update record in user registry after ownership transfer", async () => {
			assert.notInclude(await contracts.userRegistry.getUserContracts(user), userRouterAddress)
			assert.include(await contracts.userRegistry.getUserContracts(newUser), userRouterAddress)
		})

		it("should be able to change&claim contract ownership", async () => {
			await Owned.at(userRouterAddress).changeContractOwnership(user, { from: newUser, })
			assert.isTrue(await Owned.at(userRouterAddress).claimContractOwnership.call({ from: user, }))

			await Owned.at(userRouterAddress).claimContractOwnership({ from: user, })
			assert.equal(await Owned.at(userRouterAddress).contractOwner.call(), user)
		})

		it("multisig owner should change with ownership transfer", async () => {
			assert.isTrue(await UserInterface.at(userRouterAddress).isOwner(user), "current contract owner should be in multisig")
			assert.isFalse(await UserInterface.at(userRouterAddress).isOwner(newUser), "previous contract owner should not be in multisig")
		})

		it("should update record in user registry after ownership transfer", async () => {
			assert.include(await contracts.userRegistry.getUserContracts(user), userRouterAddress)
			assert.notInclude(await contracts.userRegistry.getUserContracts(newUser), userRouterAddress)
		})

		it("user should be able to transfer ownership with no set up user registry contract", async () => {
			await reverter.promisifySnapshot()
			const snapshotId = reverter.snapshotId

			assert.equal(await Owned.at(userRouterAddress).contractOwner.call(), user)
			await contracts.userBackendProvider.setUserRegistry(0x0, { from: users.contractOwner, })
			await Owned.at(userRouterAddress).transferOwnership(newUser, { from: user, })
			assert.equal(await Owned.at(userRouterAddress).contractOwner.call(), newUser)

			await reverter.promisifyRevert(snapshotId)
		})

		it("should NOT allow to change&claim a contract ownership to another user by non-contract owner", async () => {
			assert.notEqual(await Owned.at(userRouterAddress).contractOwner.call(), newUser)
			assert.isFalse(await Owned.at(userRouterAddress).changeContractOwnership.call(newUser, { from: newUser, }))

			await Owned.at(userRouterAddress).changeContractOwnership(newUser, { from: newUser, })
			assert.isFalse(await Owned.at(userRouterAddress).claimContractOwnership.call({ from: newUser, }))
		})

		it("should allow to create a user with 'use2FA = true'", async () => {
			const tx = await contracts.userFactory.createUserWithProxyAndRecovery(user, true, { from: user, })
			{
				const event = (await eventHelpers.findEvent([contracts.userFactory,], tx, "UserCreated"))[0]
				assert.isDefined(event)
				assert.isTrue(await UserInterface.at(event.args.user).use2FA.call())
			}
		})
	})

	context("update", () => {
		const user = users.user1

		let userRouter
		let userProxy

		let snapshotId

		before(async () => {
			const tx = await contracts.userFactory.createUserWithProxyAndRecovery(user, false, { from: user, })
			{
				const event = (await eventHelpers.findEvent([contracts.userFactory,], tx, "UserCreated"))[0]
				userRouter = UserInterface.at(event.args.user)
				userProxy = UserProxy.at(event.args.proxy)
			}

			snapshotId = reverter.snapshotId
			await reverter.promisifySnapshot()
		})

		after(async () => {
			await reverter.promisifyRevert(snapshotId)
		})

		describe("proxy", () => {

			let newUserProxy

			before(async () => {
				newUserProxy = await UserProxy.new({ from: users.contractOwner, })
				await newUserProxy.transferOwnership(userRouter.address, { from: users.contractOwner, })

				assert.equal(await newUserProxy.contractOwner.call(), userRouter.address)
			})

			after(async () => {
				await reverter.promisifyRevert()
			})

			afterEach(async () => {
				await contracts.mock.skipExpectations()
				await contracts.mock.resetCallsCount()
			})

			it("and user router should have a proxy", async () => {
				assert.equal(await userRouter.getUserProxy(), userProxy.address)
			})

			it("where anyone should NOT allowed to update user proxy with UNAUTHORIZED code", async () => {
				assert.equal(
					(await userRouter.setUserProxy.call(newUserProxy.address, { from: users.user3, })).toNumber(),
					ErrorScope.UNAUTHORIZED
				)
			})

			it("where user should be allowed to update user proxy with OK code", async () => {
				assert.equal(
					(await userRouter.setUserProxy.call(newUserProxy.address, { from: user, })).toNumber(),
					ErrorScope.OK
				)
			})

			it("where user should be allowed to update user proxy", async () => {
				await userRouter.setUserProxy(newUserProxy.address, { from: user, })
				assert.equal(await userRouter.getUserProxy(), newUserProxy.address)
			})

			it("and forward should NOT go through old proxy", async () => {
				const data = contracts.userFactory.contract.createUserWithProxyAndRecovery.getData(user, false)
				await contracts.mock.expect(
					userProxy.address,
					0,
					data,
					await contracts.mock.convertUIntToBytes32.call(ErrorScope.OK)
				)

				await userRouter.forward(contracts.mock.address, data, 0, true, { from: user, }).then(() => true, assert.fail)
				await customAsserts.assertExpectations(1, 1)
			})

			it("and forward should go through a new proxy", async () => {
				const data = contracts.userFactory.contract.createUserWithProxyAndRecovery.getData(user, false)
				await contracts.mock.expect(
					newUserProxy.address,
					0,
					data,
					await contracts.mock.convertUIntToBytes32.call(ErrorScope.OK)
				)

				await userRouter.forward(contracts.mock.address, data, 0, true, { from: user, }).then(() => true, assert.fail)
				await customAsserts.assertExpectations(0, 1)
			})
		})

		describe("oracle", () => {
		})

		describe("backend", () => {
			let newUserBackend

			before(async () => {
				newUserBackend = await BumpedUserBackend.new({ from: users.contractOwner, })
			})

			after(async () => {
				await reverter.promisifyRevert()
			})

			it("and have up to date backend provider address", async () => {
				assert.equal(await UserRouter.at(userRouter.address).backendProvider.call(), contracts.userBackendProvider.address)
			})

			it("and forward function should NOT have 'BumpedUserBackendEvent' event emitted", async () => {
				const data = contracts.userFactory.contract.createUserWithProxyAndRecovery.getData(user, false)
				await contracts.mock.expect(
					userProxy.address,
					0,
					data,
					await contracts.mock.convertUIntToBytes32.call(ErrorScope.OK)
				)

				const tx = await userRouter.forward(contracts.mock.address, data, 0, true, { from: user, }).then(r => r, assert.fail)
				{
					const event = (await eventHelpers.findEvent([ contracts.userBackend, userRouter, ], tx, "BumpedUserBackendEvent"))[0]
					assert.isUndefined(event)
				}
			})

			it("should THROW when pass 0x0 user backend", async () => {
				await contracts.userBackendProvider.setUserBackend(utils.zeroAddress, { from: users.contractOwner, }).then(assert.fail, () => true)
			})

			it("should update user backend in user backend provider", async () => {
				await contracts.userBackendProvider.setUserBackend(newUserBackend.address, { from: users.contractOwner, })
				assert.equal(
					await contracts.userBackendProvider.getUserBackend.call(),
					newUserBackend.address
				)
			})

			it("and forward function should have 'BumpedUserBackendEvent' event emitted", async () => {
				const data = contracts.userFactory.contract.createUserWithProxyAndRecovery.getData(user, false)
				await contracts.mock.expect(
					userProxy.address,
					0,
					data,
					await contracts.mock.convertUIntToBytes32.call(ErrorScope.OK)
				)

				const tx = await userRouter.forward(contracts.mock.address, data, 0, true, { from: user, }).then(r => r, assert.fail)
				{
					const event = (await eventHelpers.findEvent([ newUserBackend, userRouter, ], tx, "BumpedUserBackendEvent"))[0]
					assert.isDefined(event)
				}
			})
		})

		describe("backend provider", () => {
			let newUserBackendProvider
			let snapshotId

			before(async () => {
				newUserBackendProvider = await UserBackendProvider.new(contracts.rolesLibrary.address, { from: users.contractOwner, })
				await newUserBackendProvider.setUserBackend(contracts.userBackend.address, { from: users.contractOwner, })

				snapshotId = reverter.snapshotId
				await reverter.promisifySnapshot()
			})

			after(async () => {
				await reverter.promisifyRevert(snapshotId)
			})

			it("and have up to date backend provider address", async () => {
				assert.equal(await UserRouter.at(userRouter.address).backendProvider.call(), contracts.userBackendProvider.address)
			})

			it("where anyone should NOT be able to update backend by himself with UNAUTHORIZED code", async () => {
				assert.equal(
					(await userRouter.updateBackendProvider.call(newUserBackendProvider.address, { from: users.user2, })).toNumber(),
					ErrorScope.UNAUTHORIZED
				)
			})

			it("and should protect setUserBackendProvider function with auth", async () => {
				const caller = users.user2

				await reverter.promisifySnapshot()

				await contracts.userFactory.setRoles2Library(contracts.mock.address)
				await contracts.mock.expect(
					contracts.userFactory.address,
					0,
					contracts.rolesLibrary.contract.canCall.getData(caller, contracts.userFactory.address, contracts.userFactory.contract.setUserBackendProvider.getData(0x0).slice(0, 10)),
					await contracts.mock.convertUIntToBytes32(ErrorScope.OK)
				)
				assert.equal(
					(await contracts.userFactory.setUserBackendProvider.call(newUserBackendProvider.address, { from: caller, })).toNumber(),
					ErrorScope.OK
				)

				await contracts.userFactory.setUserBackendProvider(newUserBackendProvider.address, { from: caller, })
				await customAsserts.assertExpectations()

				await reverter.promisifyRevert()
			})

			it("and should THROW when pass 0x0 for user backend provider", async () => {
				await contracts.userFactory.setUserBackendProvider(utils.zeroAddress, { from: users.contractOwner, }).then(assert.fail, () => true)
			})

			it("and base backend provider should be updated in user factory first", async () => {
				await contracts.userFactory.setUserBackendProvider(newUserBackendProvider.address, { from: users.contractOwner, })
				assert.equal(await contracts.userFactory.userBackendProvider.call(), newUserBackendProvider.address)
			})

			it("and should protect updateBackendProviderForUser function with auth", async () => {
				const caller = users.user2

				await reverter.promisifySnapshot()

				await contracts.userFactory.setRoles2Library(contracts.mock.address)
				await contracts.mock.expect(
					contracts.userFactory.address,
					0,
					contracts.rolesLibrary.contract.canCall.getData(caller, contracts.userFactory.address, contracts.userFactory.contract.updateBackendProviderForUser.getData(0x0).slice(0, 10)),
					await contracts.mock.convertUIntToBytes32(ErrorScope.OK)
				)
				assert.equal(
					(await contracts.userFactory.updateBackendProviderForUser.call(userRouter.address, { from: caller, })).toNumber(),
					ErrorScope.OK
				)

				await contracts.userFactory.updateBackendProviderForUser(userRouter.address, { from: caller, })
				await customAsserts.assertExpectations()

				await reverter.promisifyRevert()
			})

			it("where issuer should be able to update backend to the newest version", async () => {
				await contracts.userFactory.updateBackendProviderForUser(userRouter.address, { from: users.contractOwner, })
				assert.equal(await UserRouter.at(userRouter.address).backendProvider.call(), newUserBackendProvider.address)
			})
		})

		describe("2FA", () => {

			after(async () => {
				await reverter.promisifyRevert()
			})

			afterEach(async () => {
				await contracts.mock.resetCallsCount()
			})

			context("when it is disabled", () => {
				let data

				before(async () => {
					data = contracts.userFactory.contract.createUserWithProxyAndRecovery.getData(user, false)
				})

				after(async () => {
					await reverter.promisifyRevert()
				})

				it("by default should be 'false'", async () => {
					assert.isFalse(await userRouter.use2FA.call())
				})

				it("should do nothing when pass 'false' again", async () => {
					assert.equal(
						(await userRouter.set2FA.call(false, { from: user, })).toNumber(),
						ErrorScope.OK
					)
				})

				it("and should allow to call forward with 2FA = 'false' immediately", async () => {
					const data = contracts.userFactory.contract.createUserWithProxyAndRecovery.getData(user, false)
					await contracts.mock.expect(
						userProxy.address,
						0,
						data,
						await contracts.mock.convertUIntToBytes32.call(ErrorScope.OK)
					)

					const tx = await userRouter.forward(contracts.mock.address, data, 0, true, { from: user, }).then(r => r, assert.fail)
					{
						const event = (await eventHelpers.findEvent([userRouter,], tx, "User2FAChanged"))[0]
						assert.isUndefined(event)
					}
					await customAsserts.assertNoMultisigPresence(tx)
				})

				it("and anyone should NOT be able to turn on 2FA with UNAUTHORIZED code", async () => {
					assert.equal(
						(await userRouter.set2FA.call(true, { from: users.user2, })).toNumber(),
						ErrorScope.UNAUTHORIZED
					)
				})

				it("and user should be able to turn on 2FA with OK code", async () => {
					assert.equal(
						(await userRouter.set2FA.call(true, { from: user, })).toNumber(),
						ErrorScope.OK
					)
				})

				it("and user should be able to turn on 2FA", async () => {
					const tx = await userRouter.set2FA(true, { from: user, })
					{
						const event = (await eventHelpers.findEvent([userRouter,], tx, "User2FAChanged"))[0]
						assert.isDefined(event)
						assert.equal(event.address, userRouter.address)
						assert.equal(event.name, 'User2FAChanged')
						assert.equal(event.args.self, userRouter.address)
						assert.equal(event.args.initiator, user)
						assert.equal(event.args.user, userRouter.address)
						assert.equal(event.args.proxy, await userRouter.getUserProxy())
						assert.isTrue(event.args.enabled)
					}
					assert.isTrue(await userRouter.use2FA.call())
				})

				it("and user should be able to submit forward call with MULTISIG_ADDED code", async () => {
					assert.equal(
						(await userRouter.forward.call(contracts.mock.address, data, 0, true, { from: user, })),
						await contracts.mock.convertUIntToBytes32(ErrorScope.MULTISIG_ADDED)
					)
				})

				let transactionId

				it("and user should be able to submit forward call but not execute without oracle", async () => {
					await contracts.mock.expect(
						userProxy.address,
						0,
						data,
						await contracts.mock.convertUIntToBytes32.call(ErrorScope.OK)
					)

					const tx = await userRouter.forward(contracts.mock.address, data, 0, true, { from: user, }).then(r => r, assert.fail)
					await customAsserts.assertExpectations(1, 0)
					transactionId = await customAsserts.assertMultisigSubmitPresence({ tx, userProxy, user, })
				})

				it("and anyone THROW and should NOT able to confirm submitted transaction and execute forward call", async () => {
					await userRouter.confirmTransaction.call(transactionId, { from: users.user3, }).then(assert.fail, () => true)
				})

				it("and user THROW and should NOT able to confirm submitted by him transaction and execute forward call", async () => {
					await userRouter.confirmTransaction.call(transactionId, { from: user, }).then(assert.fail, () => true)
				})

				it("and oracle should confirm submitted transaction and execute forward call", async () => {
					const tx = await userRouter.confirmTransaction(transactionId, { from: users.oracle, }).then(r => r, assert.fail)
					await customAsserts.assertExpectations(0, 1)
					await customAsserts.assertMultisigExecutionPresence({
						tx, transactionId, userRouter, oracle: users.oracle,
					})
					{
						const event = (await eventHelpers.findEvent([userProxy,], tx, "Forwarded"))[0]
						assert.isDefined(event)
						assert.equal(event.args.destination, contracts.mock.address)
						assert.equal(event.args.value, 0)
						assert.equal(event.args.data, data)
					}
				})

			})

			context("when it is enabled and protecting", () => {

				let snapshotId

				before(async () => {
					await userRouter.set2FA(true, { from: user, })

					snapshotId = reverter.snapshotId
					await reverter.promisifySnapshot()
				})

				after(async () => {
					await reverter.promisifyRevert(snapshotId)
				})

				it("while 2FA is true", async () => {
					assert.isTrue(await userRouter.use2FA.call())
				})

				describe("update of recovery contract", () => {
					const newRecoveryAddress = users.user3
					let transactionId

					after(async () => {
						await reverter.promisifyRevert()
					})

					it("where current recovery is NOT equal to a new recovery address", async () => {
						assert.notEqual(await userRouter.getRecoveryContract.call(), newRecoveryAddress)
					})

					it("should allow to submit update of recovery contract by a user with MULTISIG_ADDED code", async () => {
						assert.equal(
							(await userRouter.setRecoveryContract.call(newRecoveryAddress, { from: user, })).toNumber(),
							ErrorScope.MULTISIG_ADDED
						)
					})

					it("should allow to submit update of recovery contract by an user", async () => {
						const tx = await userRouter.setRecoveryContract(newRecoveryAddress, { from: user, })
						transactionId = await customAsserts.assertMultisigSubmitPresence({ tx, userProxy, user, })
					})

					it("should allow to confirm update of recovery contract by an oracle", async () => {
						const tx = await userRouter.confirmTransaction(transactionId, { from: users.oracle, })
						await customAsserts.assertMultisigExecutionPresence({
							tx, transactionId, userRouter, oracle: users.oracle,
						})
					})

					it("should have a changed recovery address", async () => {
						assert.equal(await userRouter.getRecoveryContract.call(), newRecoveryAddress)
					})
				})

				describe("not guarded by multisig a user recovery function", () => {
					const newUserOwner = users.user3

					after(async () => {
						await reverter.promisifyRevert()
					})

					it("should have valid contract owner", async () => {
						assert.equal(await Owned.at(userRouter.address).contractOwner.call(), user)
					})

					it("should NOT have multisig when trying to recover a user with OK code", async () => {
						assert.equal(
							(await userRouter.recoverUser.call(newUserOwner, { from: users.recovery, })).toNumber(),
							ErrorScope.OK
						)
					})

					it("should NOT have multisig when trying to recover a user", async () => {
						const tx = await userRouter.recoverUser(newUserOwner, { from: users.recovery, })
						await customAsserts.assertNoMultisigPresence(tx)
					})

					it("should have updated contract owner", async () => {
						assert.equal(await Owned.at(userRouter.address).contractOwner.call(), newUserOwner)
					})

					it("should have updated multisig owners", async () => {
						assert.isTrue(await userRouter.isOwner(newUserOwner))
						assert.isFalse(await userRouter.isOwner(user))
					})
				})

				describe("change contract ownership", () => {
					const newUserOwner = users.user3

					context("with transferOwnership", () => {
						after(async () => {
							await reverter.promisifyRevert()
						})

						it("should have valid contract owner", async () => {
							assert.equal(await Owned.at(userRouter.address).contractOwner.call(), user)
						})

						it("should THROW NOT allow to submit transfer of contract ownership by a contract owner", async () => {
							await Owned.at(userRouter.address).transferOwnership(newUserOwner, { from: user, }).then(assert.fail, () => true)
						})

						it("should NOT update multisig owners", async () => {
							assert.isFalse(await userRouter.isOwner(newUserOwner))
							assert.isTrue(await userRouter.isOwner(user))
						})
					})

					context("with change&claim", () => {
						after(async () => {
							await reverter.promisifyRevert()
						})

						it("should have valid contract owner", async () => {
							assert.equal(await Owned.at(userRouter.address).contractOwner.call(), user)
						})

						it("should THROW and NOT allow to submit transfer of contract ownership by a contract owner", async () => {
							await Owned.at(userRouter.address).changeContractOwnership(newUserOwner, { from: user, }).then(assert.fail, () => true)
						})

						it("should NOT update multisig owners", async () => {
							assert.isFalse(await userRouter.isOwner(newUserOwner))
							assert.isTrue(await userRouter.isOwner(user))
						})
					})
				})

				describe("update of user proxy", () => {
					const newUserProxyAddress = "0xffffffffffffffffffffffffffffffffffffffff"
					let transactionId

					after(async () => {
						await reverter.promisifyRevert()
					})

					it("where current user proxy is NOT equal to a new user proxy address", async () => {
						assert.notEqual(await userRouter.getUserProxy.call(), newUserProxyAddress)
					})

					it("should allow to submit update of user proxy by a user with MULTISIG_ADDED code", async () => {
						assert.equal(
							(await userRouter.setUserProxy.call(newUserProxyAddress, { from: user, })).toNumber(),
							ErrorScope.MULTISIG_ADDED
						)
					})

					it("should allow to submit update of user proxy by a user", async () => {
						const tx = await userRouter.setUserProxy(newUserProxyAddress, { from: user, })
						transactionId = await customAsserts.assertMultisigSubmitPresence({ tx, userProxy, user, })
					})

					it("should allow to confirm update of user proxy contract by an oracle", async () => {
						const tx = await userRouter.confirmTransaction(transactionId, { from: users.oracle, })
						await customAsserts.assertMultisigExecutionPresence({
							tx, transactionId, userRouter, oracle: users.oracle,
						})
					})

					it("should have a changed user proxy address", async () => {
						assert.equal(await userRouter.getUserProxy.call(), newUserProxyAddress)
					})
				})

				describe("update of oracle", () => {
					const newOracleAddress = users.user2
					var transactionId

					after(async () => {
						await reverter.promisifyRevert()
					})

					it("where current oracle is NOT equal to a new oracle address", async () => {
						assert.notEqual(await userRouter.getOracle.call(), newOracleAddress)
					})

					it("should allow to submit update of oracle by a user with MULTISIG_ADDED code", async () => {
						assert.equal(
							(await userRouter.setOracle.call(newOracleAddress, { from: user, })).toNumber(),
							ErrorScope.MULTISIG_ADDED
						)
					})

					it("should allow to submit update of oracle by a user", async () => {
						const tx = await userRouter.setOracle(newOracleAddress, { from: user, })
						transactionId = await customAsserts.assertMultisigSubmitPresence({ tx, userProxy, user, })
					})

					it("should allow to confirm update of oracle by an oracle", async () => {
						const tx = await userRouter.confirmTransaction(transactionId, { from: users.oracle, })
						await customAsserts.assertMultisigExecutionPresence({
							tx, transactionId, userRouter, oracle: users.oracle,
						})
					})

					it("should have a changed oracle address", async () => {
						assert.equal(await userRouter.getOracle.call(), newOracleAddress)
					})

					it("should be able to perform to submit new oracle change by a user to an old oracle with MULTISIG_ADDED code", async () => {
						assert.equal(
							(await userRouter.setOracle.call(users.oracle, { from: user, })).toNumber(),
							ErrorScope.MULTISIG_ADDED
						)
					})

					it("should be able to perform to submit new oracle change by a user to an old oracle", async () => {
						const tx = await userRouter.setOracle(users.oracle, { from: user, })
						transactionId = await customAsserts.assertMultisigSubmitPresence({ tx, userProxy, user, })
					})

					it("should THROW and NOT allow to confirm update of oracle by an old oracle", async () => {
						await userRouter.confirmTransaction(transactionId, { from: users.oracle, }).then(assert.fail, () => true)
					})

					it("should allow to confirm update of oracle by a new oracle", async () => {
						const tx = await userRouter.confirmTransaction(transactionId, { from: newOracleAddress, })
						await customAsserts.assertMultisigExecutionPresence({
							tx, transactionId, userRouter, oracle: newOracleAddress,
						})
					})

					it("should have an old oracle address back", async () => {
						assert.equal(await userRouter.getOracle.call(), users.oracle)
					})
				})

				describe("update of use2FA from 'true' to 'false'", () => {
					let transactionId

					after(async () => {
						await reverter.promisifyRevert()
					})

					it("when initial use2FA is 'true'", async () => {
						assert.isTrue(await userRouter.use2FA.call())
					})

					it("should allow to submit update of 2FA by a user with MULTISIG_ADDED code", async () => {
						assert.equal(
							(await userRouter.set2FA.call(false, { from: user, })).toNumber(),
							ErrorScope.MULTISIG_ADDED
						)
					})

					it("should allow to submit update of 2FA by a user", async () => {
						const tx = await userRouter.set2FA(false, { from: user, })
						transactionId = await customAsserts.assertMultisigSubmitPresence({ tx, userProxy, user, })
						{
							const event = (await eventHelpers.findEvent([userRouter,], tx, "User2FAChanged"))[0]
							assert.isUndefined(event)
						}
					})

					it("should allow to confirm update of 2FA contract by an oracle", async () => {
						const tx = await userRouter.confirmTransaction(transactionId, { from: users.oracle, })
						await customAsserts.assertMultisigExecutionPresence({
							tx, transactionId, userRouter, oracle: users.oracle,
						})
						{
							const event = (await eventHelpers.findEvent([userRouter,], tx, "User2FAChanged"))[0]
							assert.isDefined(event)
							assert.equal(event.address, userRouter.address)
							assert.equal(event.name, 'User2FAChanged')
							assert.equal(event.args.self, userRouter.address)
							assert.equal(event.args.initiator, user)
							assert.equal(event.args.user, userRouter.address)
							assert.equal(event.args.proxy, userProxy.address)
							assert.isFalse(event.args.enabled)
						}
					})

					it("should have a changed 2FA address", async () => {
						assert.isFalse(await userRouter.use2FA.call())
					})
				})
			})

		})

		describe("2FA with signed data", () => {
			const pass = "0x1234"
			let message
			let signatureDetails
			let data

			before(async () => {
				data = contracts.userFactory.contract.createUserWithProxyAndRecovery.getData(user, false)
			})

			after(async () => {
				await reverter.promisifyRevert()
			})

			describe("for forwardWithVRS", () => {

				describe("with disabled 2FA", () => {

					afterEach(async () => {
						await contracts.mock.skipExpectations()
						await contracts.mock.resetCallsCount()
					})

					it("should have use2FA = false", async () => {
						assert.isFalse(await userRouter.use2FA())
					})

					it("should allow to forward invocation without submitting tx", async () => {
						await contracts.mock.expect(
							userProxy.address,
							0,
							data,
							await contracts.mock.convertUIntToBytes32.call(ErrorScope.OK)
						)

						const tx = await userRouter.forwardWithVRS(
							contracts.mock.address,
							data,
							0,
							true,
							pass,
							0,
							"",
							"",
							{ from: user, }
						)
						await customAsserts.assertExpectations(0, 1)
						await customAsserts.assertNoMultisigPresence(tx)
					})
				})

				describe("with enabled 2FA", () => {

					before(async () => {
						await userRouter.set2FA(true, { from: user, })
					})

					afterEach(async () => {
						await contracts.mock.skipExpectations()
						await contracts.mock.resetCallsCount()
					})

					it("should have use2FA = true", async () => {
						assert.isTrue(await userRouter.use2FA())
					})

					it("should NOT allow to forward invocation without proper v,r,s", async () => {
						await contracts.mock.expect(
							userProxy.address,
							0,
							data,
							await contracts.mock.convertUIntToBytes32.call(ErrorScope.OK)
						)

						const tx = await userRouter.forwardWithVRS(
							contracts.mock.address,
							data,
							0,
							true,
							pass,
							0,
							"",
							"",
							{ from: user, }
						)
						await customAsserts.assertExpectations(1, 0)
						await customAsserts.assertNoMultisigPresence(tx)
					})

					describe("signed by invalid oracle", () => {
						const notOracle = users.user2

						before(async () => {
							message = messageComposer.composeForwardMessageFrom({
								pass, sender: user, destination: contracts.mock.address, data, value: 0,
							})
							signatureDetails = messageComposer.signMessage({ message, oracle: notOracle, })
						})

						afterEach(async () => {
							await contracts.mock.skipExpectations()
							await contracts.mock.resetCallsCount()
						})

						it("should NOT allow to forward invocation", async () => {
							await contracts.mock.expect(
								userProxy.address,
								0,
								data,
								await contracts.mock.convertUIntToBytes32.call(ErrorScope.OK)
							)

							const tx = await userRouter.forwardWithVRS(
								contracts.mock.address,
								data,
								0,
								true,
								pass,
								signatureDetails.v,
								signatureDetails.r,
								signatureDetails.s,
								{ from: user, }
							)
							await customAsserts.assertExpectations(1, 0)
							await customAsserts.assertNoMultisigPresence(tx)
						})
					})

					describe("signed with invalid sender", () => {
						const notUser = users.user2

						before(async () => {
							message = messageComposer.composeForwardMessageFrom({
								pass, sender: user, destination: contracts.mock.address, data, value: 0,
							})
							signatureDetails = messageComposer.signMessage({ message, oracle: users.oracle, })
						})

						afterEach(async () => {
							await contracts.mock.skipExpectations()
							await contracts.mock.resetCallsCount()
						})

						it("should NOT allow to forward invocation", async () => {
							await contracts.mock.expect(
								userProxy.address,
								0,
								data,
								await contracts.mock.convertUIntToBytes32.call(ErrorScope.OK)
							)

							const tx = await userRouter.forwardWithVRS(
								contracts.mock.address,
								data,
								0,
								true,
								pass,
								signatureDetails.v,
								signatureDetails.r,
								signatureDetails.s,
								{ from: notUser, }
							)
							await customAsserts.assertExpectations(1, 0)
							await customAsserts.assertNoMultisigPresence(tx)
						})
					})

					describe("signed correctly with invalid data", () => {
						let invalidSendData

						before(async () => {
							invalidSendData = contracts.userFactory.contract.createUserWithProxyAndRecovery.getData(users.user2, true)
							message = messageComposer.composeForwardMessageFrom({
								pass, sender: user, destination: contracts.mock.address, data, value: 0,
							})
							signatureDetails = messageComposer.signMessage({ message, oracle: users.oracle, })
						})

						afterEach(async () => {
							await contracts.mock.skipExpectations()
							await contracts.mock.resetCallsCount()
						})

						it("should NOT allow to forward invocation", async () => {
							await contracts.mock.expect(
								userProxy.address,
								0,
								data,
								await contracts.mock.convertUIntToBytes32.call(ErrorScope.OK)
							)

							const tx = await userRouter.forwardWithVRS(
								contracts.mock.address,
								invalidSendData,
								0,
								true,
								pass,
								signatureDetails.v,
								signatureDetails.r,
								signatureDetails.s,
								{ from: user, }
							)
							await customAsserts.assertExpectations(1, 0)
							await customAsserts.assertNoMultisigPresence(tx)
						})
					})

					describe("signed correctly with invalid pass", () => {
						const invalidPass = "0xffffffff"

						before(async () => {
							message = messageComposer.composeForwardMessageFrom({
								pass, sender: user, destination: contracts.mock.address, data, value: 0,
							})
							signatureDetails = messageComposer.signMessage({ message, oracle: users.oracle, })
						})

						afterEach(async () => {
							await contracts.mock.skipExpectations()
							await contracts.mock.resetCallsCount()
						})

						it("should NOT allow to forward invocation", async () => {
							await contracts.mock.expect(
								userProxy.address,
								0,
								data,
								await contracts.mock.convertUIntToBytes32.call(ErrorScope.OK)
							)

							const tx = await userRouter.forwardWithVRS(
								contracts.mock.address,
								data,
								0,
								true,
								invalidPass,
								signatureDetails.v,
								signatureDetails.r,
								signatureDetails.s,
								{ from: user, }
							)
							await customAsserts.assertExpectations(1, 0)
							await customAsserts.assertNoMultisigPresence(tx)
						})
					})

					describe("signed correctly", () => {
						let destination

						before(async () => {
							destination = contracts.mock.address
							message = messageComposer.composeForwardMessageFrom({
								pass, sender: user, destination: destination, data, value: 0,
							})
							signatureDetails = messageComposer.signMessage({ message, oracle: users.oracle, })
						})

						afterEach(async () => {
							await contracts.mock.skipExpectations()
							await contracts.mock.resetCallsCount()
						})

						it("should allow to forward invocation", async () => {
							await contracts.mock.expect(
								userProxy.address,
								0,
								data,
								await contracts.mock.convertUIntToBytes32.call(ErrorScope.OK)
							)
							
							const tx = await userRouter.forwardWithVRS(
								destination,
								data,
								0,
								true,
								pass,
								signatureDetails.v,
								signatureDetails.r,
								signatureDetails.s,
								{ from: user, }
							)
							await customAsserts.assertExpectations(0, 1)
							await customAsserts.assertNoMultisigPresence(tx)
						})
					})
				})
			})
		})

		describe("2FA with 3rd party owners", () => {
			const nonOwner = users.user3
			let snapshotId

			before(async () => {
				snapshotId = reverter.snapshotId
			})

			after(async () => {
				await reverter.promisifyRevert(snapshotId)
			})

			context("when 2FA disabled", () => {

				it("should have use2FA = false", async () => {
					assert.isFalse(await userRouter.use2FA())
				})

				it("should show that original owner is not 3rd party owner", async () => {
					assert.isFalse(await userRouter.isThirdPartyOwner.call(user), "Original owner should not be 3rd party owner")
					assert.lengthOf(await userRouter.getThirdPartyOwners.call(), 0, "3rd party owners list should be empty")
				})

				after(async () => {
					await reverter.promisifyRevert()
				})

				context("add 3rd party owners", () => {

					let snapshotId

					before(async () => {
						snapshotId = reverter.snapshotId
						await reverter.promisifySnapshot()
					})

					after(async () => {
						await reverter.promisifyRevert(snapshotId)
					})

					it("should NOT allow by non-owner with UNAUTHORIZED code", async () => {
						assert.equal(
							(await userRouter.addThirdPartyOwner.call(users.remoteOwner1, { from: nonOwner, })).toString(16),
							ErrorScope.UNAUTHORIZED.toString(16)
						)
					})

					it("should allow by original owner with OK code", async () => {
						assert.equal(
							(await userRouter.addThirdPartyOwner.call(users.remoteOwner1, { from: user, })).toString(16),
							ErrorScope.OK.toString(16)
						)
					})

					it("should allow by original owner", async () => {
						const tx = await userRouter.addThirdPartyOwner(users.remoteOwner1, { from: user, })
						{
							const event = (await eventHelpers.findEvent([userRouter,], tx, "OwnerAddition"))[0]
							assert.isDefined(event, "No event was found")
							assert.equal(event.address, userRouter.address, "Invalid event source")
							assert.equal(event.args.owner, users.remoteOwner1, "Invalid event 'owner' address")
						}
					})

					it("should be presented in a list", async () => {
						assert.isFalse(await userRouter.isThirdPartyOwner.call(user), "Original owner should not be 3rd party owner")
						assert.isTrue(await userRouter.isThirdPartyOwner.call(users.remoteOwner1), "Remote owner should become a 3rd party owner")
						assert.include(await userRouter.getThirdPartyOwners.call(), users.remoteOwner1, "Remote owner should be included in list of 3rd party owners")
					})

					it("should NOT allow by 3rd party owner with UNAUTHORIZED code", async () => {
						assert.equal(
							(await userRouter.addThirdPartyOwner.call(users.remoteOwner2, { from: users.remoteOwner1, })).toString(16),
							ErrorScope.UNAUTHORIZED.toString(16)
						)
					})

					it("should NOT allow by 3rd party owner", async () => {
						const tx = await userRouter.addThirdPartyOwner(users.remoteOwner2, { from: users.remoteOwner1, })
						{
							const event = (await eventHelpers.findEvent([userRouter,], tx, "OwnerAddition"))[0]
							assert.isUndefined(event, "No event expected")
						}

						assert.isFalse(await userRouter.isThirdPartyOwner.call(users.remoteOwner2), "Remote owner should not become a 3rd party owner")
					})
				})

				context("revoke 3rd party owners", () => {

					let snapshotId

					before(async () => {
						snapshotId = reverter.snapshotId
						await reverter.promisifySnapshot()

						// setup
						await userRouter.addThirdPartyOwner(users.remoteOwner1, { from: user, })
					})

					after(async () => {
						await reverter.promisifyRevert(snapshotId)
					})

					it("should be presented in a list before revoking", async () => {
						assert.isTrue(await userRouter.isThirdPartyOwner.call(users.remoteOwner1), "Remote owner should present as 3rd party owner")
					})

					it("should NOT allow by non-owner with UNAUTHORIZED code", async () => {
						assert.equal(
							(await userRouter.revokeThirdPartyOwner.call(users.remoteOwner1, { from: nonOwner, })).toString(16),
							ErrorScope.UNAUTHORIZED.toString(16)
						)
					})

					it("should NOT allow by 3rd party owner with UNAUTHORIZED code", async () => {
						assert.equal(
							(await userRouter.revokeThirdPartyOwner.call(users.remoteOwner1, { from: users.remoteOwner1, })).toString(16),
							ErrorScope.UNAUTHORIZED.toString(16)
						)
					})

					it("should allow by original owner with OK code", async () => {
						assert.equal(
							(await userRouter.revokeThirdPartyOwner.call(users.remoteOwner1, { from: user, })).toString(16),
							ErrorScope.OK.toString(16)
						)
					})

					it("should allow by original owner", async () => {
						const tx = await userRouter.revokeThirdPartyOwner(users.remoteOwner1, { from: user, })
						{
							const event = (await eventHelpers.findEvent([userRouter,], tx, "OwnerRemoval"))[0]
							assert.isDefined(event, "No event was found")
							assert.equal(event.address, userRouter.address, "Invalid event source")
							assert.equal(event.args.owner, users.remoteOwner1, "Invalid event 'owner' address")
						}
					})

					it("should THROW and NOT allow unexisted 3rd party owner by original owner", async () => {
						await userRouter.revokeThirdPartyOwner(users.remoteOwner1, { from: user, }).then(assert.fail, () => true)
					})

					it("should NOT be presented in a list", async () => {
						assert.isFalse(await userRouter.isThirdPartyOwner.call(user), "Original owner should not be 3rd party owner")
						assert.isFalse(await userRouter.isThirdPartyOwner.call(users.remoteOwner1), "Revoked remote owner should not be a 3rd party owner anymore")
						assert.notInclude(await userRouter.getThirdPartyOwners.call(), users.remoteOwner1, "Revoked remote owner should not be included in list of 3rd party owners")
					})
				})

				context("operations", () => {

					const remoteOwner = users.remoteOwner1
					let data

					let snapshotId

					before(async () => {
						snapshotId = reverter.snapshotId
						await reverter.promisifySnapshot()

						// setup
						data = contracts.userFactory.contract.createUserWithProxyAndRecovery.getData(user, false)

						await userRouter.addThirdPartyOwner(remoteOwner, { from: user, })
					})

					after(async () => {
						await reverter.promisifyRevert(snapshotId)
					})


					it("should NOT allow to update recovery contract", async () => {
						const newRecoveryAddress = "0xffffffffffffffffffffffffffffffffffffffff"
						assert.equal(
							(await userRouter.setRecoveryContract.call(newRecoveryAddress, { from: remoteOwner, })).toString(16),
							ErrorScope.UNAUTHORIZED.toString(16)
						)
					})

					it("should NOT allow to change contract ownership", async () => {
						assert.isFalse(await Owned.at(userRouter.address).transferOwnership.call(users.user2, { from: remoteOwner, }))
					})

					it("should NOT allow to update user proxy address", async () => {
						const newUserProxyAddress = "0xffffffffffffffffffffffffffffffffffffffff"
						assert.equal(
							(await userRouter.setUserProxy.call(newUserProxyAddress, { from: remoteOwner, })).toString(16),
							ErrorScope.UNAUTHORIZED.toString(16)
						)
					})

					it("should NOT allow to update oracle address", async () => {
						const newOracleAddress = "0xffffffffffffffffffffffffffffffffffffffff"
						assert.equal(
							(await userRouter.setOracle.call(newOracleAddress, { from: remoteOwner, })).toString(16),
							ErrorScope.UNAUTHORIZED.toString(16)
						)
					})

					it("should NOT allow to update 2FA (from 'false' to 'true')", async () => {
						assert.equal(
							(await userRouter.set2FA.call(true, { from: remoteOwner, })).toString(16),
							ErrorScope.UNAUTHORIZED.toString(16)
						)
					})

					it("should allow to 'forward'", async () => {
						await contracts.mock.expect(
							userProxy.address,
							0,
							data,
							await contracts.mock.convertUIntToBytes32.call(ErrorScope.OK)
						)

						const tx = await userRouter.forward(contracts.mock.address, data, 0, true, { from: remoteOwner, }).then(r => r, assert.fail)
						await customAsserts.assertNoMultisigPresence(tx)
					})

					it("should allow to 'forwardWithVRS'", async () => {
						const pass = "0x1234"

						await contracts.mock.expect(
							userProxy.address,
							0,
							data,
							await contracts.mock.convertUIntToBytes32.call(ErrorScope.OK)
						)

						const tx = await userRouter.forwardWithVRS(
							contracts.mock.address,
							data,
							0,
							true,
							pass,
							0,
							"",
							"",
							{ from: remoteOwner, }
						)
						await customAsserts.assertExpectations()
						await customAsserts.assertNoMultisigPresence(tx)
					})
				})
			})

			context("when 2FA enabled", () => {

				let snapshotId

				before(async () => {
					await userRouter.set2FA(true, { from: user, })

					snapshotId = reverter.snapshotId
					await reverter.promisifySnapshot()
				})

				after(async () => {
					await reverter.promisifyRevert(snapshotId)
				})

				it("should have use2FA = true", async () => {
					assert.isTrue(await userRouter.use2FA())
				})

				it("should show that original owner is not 3rd party owner", async () => {
					assert.isFalse(await userRouter.isThirdPartyOwner.call(user), "Original owner should not be 3rd party owner")
					assert.lengthOf(await userRouter.getThirdPartyOwners.call(), 0, "3rd party owners list should be empty")
				})

				context("add 3rd party owners", () => {
					let snapshotId

					before(async () => {
						snapshotId = reverter.snapshotId
						await reverter.promisifySnapshot()
					})

					after(async () => {
						await reverter.promisifyRevert(snapshotId)
					})

					it("should NOT allow by non-owner with UNAUTHORIZED code", async () => {
						assert.equal(
							(await userRouter.addThirdPartyOwner.call(users.remoteOwner1, { from: nonOwner, })).toString(16),
							ErrorScope.UNAUTHORIZED.toString(16)
						)
					})

					it("should allow by original owner with MULTISIG_ADDED code", async () => {
						assert.equal(
							(await userRouter.addThirdPartyOwner.call(users.remoteOwner1, { from: user, })).toString(16),
							ErrorScope.MULTISIG_ADDED.toString(16)
						)
					})

					it("should allow by original owner", async () => {
						const tx = await userRouter.addThirdPartyOwner(users.remoteOwner1, { from: user, })
						const transactionId = await customAsserts.assertMultisigSubmitPresence({ tx, userProxy, user, })

						// confirmation
						{
							const tx = await userRouter.confirmTransaction(transactionId, { from: users.oracle, })
							await customAsserts.assertMultisigExecutionPresence({
								tx, transactionId, userRouter, oracle: users.oracle,
							})
						}
					})

					it("should be presented in a list", async () => {
						assert.isFalse(await userRouter.isThirdPartyOwner.call(user), "Original owner should not be 3rd party owner")
						assert.isTrue(await userRouter.isThirdPartyOwner.call(users.remoteOwner1), "Remote owner should become a 3rd party owner")
						assert.include(await userRouter.getThirdPartyOwners.call(), users.remoteOwner1, "Remote owner should be included in list of 3rd party owners")
					})

					it("should NOT allow by 3rd party owner with UNAUTHORIZED code", async () => {
						assert.equal(
							(await userRouter.addThirdPartyOwner.call(users.remoteOwner2, { from: users.remoteOwner1, })).toString(16),
							ErrorScope.UNAUTHORIZED.toString(16)
						)
					})

					it("should NOT allow by 3rd party owner", async () => {
						const tx = await userRouter.addThirdPartyOwner(users.remoteOwner2, { from: users.remoteOwner1, })
						await customAsserts.assertNoMultisigPresence(tx)

						assert.isFalse(await userRouter.isThirdPartyOwner.call(users.remoteOwner2), "Remote owner should not become a 3rd party owner")
					})
				})

				context("revoke 3rd party owners", () => {
					let snapshotId

					before(async () => {
						snapshotId = reverter.snapshotId
						await reverter.promisifySnapshot()

						// setup
						{
							const tx = await userRouter.addThirdPartyOwner(users.remoteOwner1, { from: user, })
							const transactionId = await customAsserts.assertMultisigSubmitPresence({ tx, userProxy, user, })
							await userRouter.confirmTransaction(transactionId, { from: users.oracle, })
						}
					})

					after(async () => {
						await reverter.promisifyRevert(snapshotId)
					})

					it("should be presented in a list before revoking", async () => {
						assert.isTrue(await userRouter.isThirdPartyOwner.call(users.remoteOwner1), "Remote owner should present as 3rd party owner")
					})

					it("should NOT allow by non-owner with UNAUTHORIZED code", async () => {
						assert.equal(
							(await userRouter.revokeThirdPartyOwner.call(users.remoteOwner1, { from: nonOwner, })).toString(16),
							ErrorScope.UNAUTHORIZED.toString(16)
						)
					})

					it("should NOT allow by 3rd party owner with UNAUTHORIZED code", async () => {
						assert.equal(
							(await userRouter.revokeThirdPartyOwner.call(users.remoteOwner1, { from: users.remoteOwner1, })).toString(16),
							ErrorScope.UNAUTHORIZED.toString(16)
						)
					})

					it("should allow by original owner with OK code", async () => {
						assert.equal(
							(await userRouter.revokeThirdPartyOwner.call(users.remoteOwner1, { from: user, })).toString(16),
							ErrorScope.MULTISIG_ADDED.toString(16)
						)
					})

					it("should allow by original owner", async () => {
						const tx = await userRouter.revokeThirdPartyOwner(users.remoteOwner1, { from: user, })
						const transactionId = await customAsserts.assertMultisigSubmitPresence({ tx, userProxy, user, })

						// confirmation
						{
							const tx = await userRouter.confirmTransaction(transactionId, { from: users.oracle, })
							await customAsserts.assertMultisigExecutionPresence({
								tx, transactionId, userRouter, oracle: users.oracle,
							})
						}
					})

					it("should NOT allow unexisted 3rd party owner by original owner with 'ExecutionFailure' event emitted", async () => {
						const tx = await userRouter.revokeThirdPartyOwner(users.remoteOwner1, { from: user, })
						const transactionId = await customAsserts.assertMultisigSubmitPresence({ tx, userProxy, user, })

						// confirmation
						const confirmationTx = await userRouter.confirmTransaction(transactionId, { from: users.oracle, })
						{
							const event = (await eventHelpers.findEvent([userRouter,], confirmationTx, "ExecutionFailure"))[0]
							assert.isDefined(event, "Event 'ExecutionFailure' should be emitted")
							assert.equal(event.address, userRouter.address, "Event source should be user router")
							assert.equal(event.args.transactionId, transactionId, "Failed transaction should be equal to confirmed transaction from event")
						}
					})

					it("should NOT be presented in a list", async () => {
						assert.isFalse(await userRouter.isThirdPartyOwner.call(user), "Original owner should not be 3rd party owner")
						assert.isFalse(await userRouter.isThirdPartyOwner.call(users.remoteOwner1), "Revoked remote owner should not be a 3rd party owner anymore")
						assert.notInclude(await userRouter.getThirdPartyOwners.call(), users.remoteOwner1, "Revoked remote owner should not be included in list of 3rd party owners")
					})
				})

				context("operations", () => {

					const remoteOwner = users.remoteOwner1

					let snapshotId

					before(async () => {
						snapshotId = reverter.snapshotId
						await reverter.promisifySnapshot()

						// setup
						{
							const tx = await userRouter.addThirdPartyOwner(remoteOwner, { from: user, })
							const transactionId = await customAsserts.assertMultisigSubmitPresence({ tx, userProxy, user, })
							await userRouter.confirmTransaction(transactionId, { from: users.oracle, })
						}
					})

					after(async () => {
						await reverter.promisifyRevert(snapshotId)
					})


					it("should NOT allow to update recovery contract", async () => {
						const newRecoveryAddress = "0xffffffffffffffffffffffffffffffffffffffff"
						assert.equal(
							(await userRouter.setRecoveryContract.call(newRecoveryAddress, { from: remoteOwner, })).toString(16),
							ErrorScope.UNAUTHORIZED.toString(16)
						)
					})

					it("should NOT allow to update user proxy address", async () => {
						const newUserProxyAddress = "0xffffffffffffffffffffffffffffffffffffffff"
						assert.equal(
							(await userRouter.setUserProxy.call(newUserProxyAddress, { from: remoteOwner, })).toString(16),
							ErrorScope.UNAUTHORIZED.toString(16)
						)
					})

					it("should NOT allow to update oracle address", async () => {
						const newOracleAddress = "0xffffffffffffffffffffffffffffffffffffffff"
						assert.equal(
							(await userRouter.setOracle.call(newOracleAddress, { from: remoteOwner, })).toString(16),
							ErrorScope.UNAUTHORIZED.toString(16)
						)
					})

					it("should NOT allow to update 2FA (from 'false' to 'true')", async () => {
						assert.equal(
							(await userRouter.set2FA.call(true, { from: remoteOwner, })).toString(16),
							ErrorScope.UNAUTHORIZED.toString(16)
						)
					})

					context("forward", () => {
						let data

						before(async () => {
							data = contracts.userFactory.contract.createUserWithProxyAndRecovery.getData(user, false)
						})

						afterEach(async () => {
							await contracts.mock.skipExpectations()
							await contracts.mock.resetCallsCount()
						})

						it("single", async () => {
							await contracts.mock.expect(
								userProxy.address,
								0,
								data,
								await contracts.mock.convertUIntToBytes32.call(ErrorScope.OK)
							)

							const tx = await userRouter.forward(contracts.mock.address, data, 0, true, { from: remoteOwner, }).then(r => r, assert.fail)
							await customAsserts.assertExpectations(1, 0)

							const transactionId = await customAsserts.assertMultisigSubmitPresence({ tx, userProxy, user: remoteOwner, })
							const confirmationTx = await userRouter.confirmTransaction(transactionId, { from: users.oracle, }).then(r => r, assert.fail)
							await customAsserts.assertExpectations(0, 1)
							await customAsserts.assertMultisigExecutionPresence({
								tx: confirmationTx, transactionId, userRouter, oracle: users.oracle,
							})
						})

						describe("with V, R, S", () => {
							const pass = "0x1234"
							let message
							let signatureDetails

							before(async () => {
								message = messageComposer.composeForwardMessageFrom({
									pass, sender: remoteOwner, destination: contracts.mock.address, data, value: 0,
								})
								signatureDetails = messageComposer.signMessage({ message, oracle: users.oracle, })
							})

							it("should allow to forward invocation", async () => {
								await contracts.mock.expect(
									userProxy.address,
									0,
									data,
									await contracts.mock.convertUIntToBytes32.call(ErrorScope.OK)
								)

								const tx = await userRouter.forwardWithVRS(
									contracts.mock.address,
									data,
									0,
									true,
									pass,
									signatureDetails.v,
									signatureDetails.r,
									signatureDetails.s,
									{ from: remoteOwner, }
								)
								await customAsserts.assertExpectations(0, 1)
								await customAsserts.assertNoMultisigPresence(tx)
							})
						})
					})
				})
			})
		})
	})
})


contract.only("User ('forward' cashback)", accounts => {
	const reverter = new Reverter(web3)
	const { users, } = getUsers(accounts)
	const asyncWeb3 = new AsyncWeb3(web3)
	const bytesChecker = new BytesChecker()

	let contracts
	let customAsserts

	const userAccount = {
		address: users.user1,
		routerAddress: null,
		proxyAddress: null,
		router: null,
		proxy: null,
	}

	before("setup", async () => {
		await reverter.promisifySnapshot()

		contracts = await setupUserWorkflow({ users, })
		contracts.fakeInterface = await FakeContractInterface.new()
		customAsserts = new CustomAsserts(contracts)

		{
			const tx = await contracts.userFactory.createUserWithProxyAndRecovery(userAccount.address, false, { from: userAccount.address, })
			{
				const event = (await eventHelpers.findEvent([contracts.userFactory,], tx, "UserCreated"))[0]
				assert.isDefined(event)
				assert.isDefined(event.args.user)
				assert.isDefined(event.args.proxy)
				assert.equal(event.args.recoveryContract, users.recovery)
				assert.equal(event.args.owner, userAccount.address)

				userAccount.routerAddress = event.args.user
				userAccount.proxyAddress = event.args.proxy
				userAccount.router = await UserInterface.at(userAccount.routerAddress)
				userAccount.proxy = await UserProxy.at(userAccount.proxyAddress)
			}
		}

		await reverter.promisifySnapshot()
	})

	after(async () => {
		await reverter.promisifyRevert(0)
	})

	context("cashback flag", () => {
		let snapshotId

		before(async () => {
			await reverter.promisifySnapshot()
			snapshotId = reverter.snapshotId
		})

		after(async () => {
			await reverter.promisifyRevert(snapshotId)
		})

		it("should be 'false' by default for user backend", async () => {
			assert.isFalse(await contracts.userBackend.isUsingCashback())
		})

		it("should be 'false' for user router", async () => {
			assert.isFalse(await UserBackend.at(userAccount.routerAddress).isUsingCashback())
		})

		it("should THROW and NOT allow a setup in user router", async () => {
			await UserBackend.at(userAccount.routerAddress).setUseCashback(true, { from: userAccount.address, }).then(assert.fail, () => true)
		})

		it("should NOT allow a setup in userBackend for non-contract owner with UNAUTHORIZED code", async () => {
			const noncontractOwner = users.user2
			assert.notEqual(noncontractOwner, users.contractOwner)
			assert.equal(
				(await contracts.userBackend.setUseCashback.call(true, { from: noncontractOwner, })).toString(16),
				ErrorScope.UNAUTHORIZED.toString(16)
			)
		})

		it("should allow a setup in userBackend for contract owner with OK code", async () => {
			assert.equal(
				(await contracts.userBackend.setUseCashback.call(true, { from: users.contractOwner, })).toString(16),
				ErrorScope.OK.toString(16)
			)
		})

		it("hould allow a setup in userBackend for contract owner", async () => {
			await contracts.userBackend.setUseCashback(true, { from: users.contractOwner, })
			assert.isTrue(await contracts.userBackend.isUsingCashback())
		})

		it("should be 'true' for user router", async () => {
			assert.isTrue(await UserBackend.at(userAccount.routerAddress).isUsingCashback())
		})
	})

	context("cashback = 'on'", () => {
		const fakeAddress = "0x2323232323232323232323232323232323232323"
		const fakeAccountAddress = "0x5555555555555555555555555555555555555555"
		const customReturn = "0x0000ffff0000ffff0000ffff0000aaff0000ffff0000ffff0000ffff0000aaff"

		let snapshotId

		before(async () => {
			await reverter.promisifySnapshot()
			snapshotId = reverter.snapshotId
			
			await contracts.userBackend.setUseCashback(true, { from: users.contractOwner, })

			await reverter.promisifySnapshot()
		})

		after(async () => {
			await reverter.promisifyRevert(snapshotId)
		})

		it("should be 'true' for user backend", async () => {
			assert.isTrue(await contracts.userBackend.isUsingCashback())
		})

		it("should be 'true' for user router", async () => {
			assert.isTrue(await UserBackend.at(userAccount.routerAddress).isUsingCashback())
		})

		context("2FA = 'off'", () => {
			let dataProvider
			let snapshotId

			const sentEther = web3.toWei("1", "ether")
			let proxyBalanceBefore
			let oracleBalanceBefore

			before(async () => {
				dataProvider = {
					getDescription: () => `${'userBackend.set2FA(bool)'}`,
					getData: () => contracts.userBackend.contract.set2FA.getData(true),
				}

				await reverter.promisifySnapshot()
				snapshotId = reverter.snapshotId

				await contracts.mock.expect(
					userAccount.proxyAddress,
					0,
					dataProvider.getData(),
					customReturn
				)

				await asyncWeb3.sendEth({ from: userAccount.address, to: userAccount.proxyAddress, value: sentEther, })
				proxyBalanceBefore = await asyncWeb3.getEthBalance(userAccount.proxyAddress)
				oracleBalanceBefore = await asyncWeb3.getEthBalance(users.oracle)
			})

			after(async () => {
				await reverter.promisifyRevert(snapshotId)
			})

			it("should 2FA be 'off'", async () => {
				assert.isFalse(await userAccount.router.use2FA.call())
			})

			it("should NOT have a payment back", async () => {
				await userAccount.router.forward(contracts.mock.address, dataProvider.getData(), 0, true, { from: userAccount.address, })
				await customAsserts.assertExpectations(0,1)

				const proxyBalanceAfter = await asyncWeb3.getEthBalance(userAccount.proxyAddress)
				const oracleBalanceAfter = await asyncWeb3.getEthBalance(users.oracle)

				assert.equal(proxyBalanceBefore.toString(16), proxyBalanceAfter.toString(16))
				assert.equal(oracleBalanceBefore.toString(16), oracleBalanceAfter.toString(16))
			})
		})
		
		context("2FA = 'on'", () => {

			before(async () => {
				await userAccount.router.set2FA(true, { from: userAccount.address, })
			})

			const thirdPartyOwners = [
				[],
				[ users.user2, ],
				[ users.user2, users.user3, ],
				[ users.user2, users.user3, users.remoteOwner1, ],
				[ users.user2, users.user3, users.remoteOwner1, users.remoteOwner2, ],
				[ users.user2, users.user3, users.remoteOwner1, users.remoteOwner2, users.recovery, ],
			]

			{
				const data = [
					{
						getDescription: () => `${'userBackend.getUserProxy()'}`,
						getData: () => contracts.userBackend.contract.getUserProxy.getData(),
					},
					{
						getDescription: () => `${'userBackend.setUserProxy(address)'}`,
						getData: () => contracts.userBackend.contract.setUserProxy.getData(fakeAddress),
					},
					{
						getDescription: () => `${'userBackend.set2FA(bool)'}`,
						getData: () => contracts.userBackend.contract.set2FA.getData(true),
					},
					{
						getDescription: () => `${'userBackend.forwardWithVRS(...) with almost empty data'}`,
						getData: () => contracts.userBackend.contract.forwardWithVRS.getData(fakeAddress, contracts.userBackend.contract.setRecoveryContract.getData(fakeAddress), 0, false, "0x44ee", 1, "0x44ee", "0x44ee"),
					},
					{
						getDescription: () => `${'rolesLibrary.setRootUser(address)'}`,
						getData: () => contracts.rolesLibrary.contract.setRootUser.getData(fakeAccountAddress, true),
					},
					{
						getDescription: () => `${'rolesLibrary.setPublicCapability(address,bytes4,bool)'}`,
						getData: () => contracts.rolesLibrary.contract.setPublicCapability.getData(fakeAddress, "0xbb11bb", true),
					},
					{
						getDescription: () => `${'userRegistry.removeUserContractFrom(address,address)'}`,
						getData: () => contracts.userRegistry.contract.removeUserContractFrom.getData(fakeAddress, fakeAccountAddress),
					},
					{
						getDescription: () => `${'fakeInterface.postJobInBoard(uint,uint,uint,uint,uint,bytes32,uint)'}`,
						getData: () => contracts.fakeInterface.contract.postJobInBoard.getData(12,4,3,2,100000000,"0xeeeeeeffffffaaaaaaaacccccccccc",43),
					},
					{
						getDescription: () => `${'fakeInterface.postJobOffer(uint,uint,uint,uint)'}`,
						getData: () => contracts.fakeInterface.contract.postJobOffer.getData(12,100000000,1000,200000000),
					},
					{
						getDescription: () => `${'fakeInterface.transferWithFee(address,address,uint,uint)'}`,
						getData: () => contracts.fakeInterface.contract.transferWithFee.getData(fakeAddress,fakeAccountAddress,23,43),
					},
					{
						getDescription: () => `${'fakeInterface.transferToMany(address,address[],uint[],uint,uint) - short'}`,
						getData: () => contracts.fakeInterface.contract.transferToMany.getData(fakeAddress,[fakeAccountAddress,],[23,],2,100023242),
					},
					{
						getDescription: () => `${'fakeInterface.transferToMany(address,address[],uint[],uint,uint) - medium'}`,
						getData: () => contracts.fakeInterface.contract.transferToMany.getData(fakeAddress,[fakeAccountAddress,fakeAccountAddress,fakeAccountAddress,fakeAccountAddress,fakeAccountAddress,],[23,23,23,23,23,],2,100023242),
					},
					{
						getDescription: () => `${'fakeInterface.transferToMany(address,address[],uint[],uint,uint) - long'}`,
						getData: () => contracts.fakeInterface.contract.transferToMany.getData(fakeAddress,[fakeAccountAddress,fakeAccountAddress,fakeAccountAddress,fakeAccountAddress,fakeAccountAddress,fakeAccountAddress,fakeAccountAddress,fakeAccountAddress,fakeAccountAddress,fakeAccountAddress,fakeAccountAddress,fakeAccountAddress,],[23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,],2,100023242),
					},
					{
						getDescription: () => `${'fakeInterface.rateWorkerSkills(uint,address,uint,uint,uint[],uint8[]) - medium'}`,
						getData: () => contracts.fakeInterface.contract.rateWorkerSkills.getData(1883729878287234,fakeAddress,2828237987942,20029328492348298,[89279872,234234,2342,3534534534,345345304980980292345,2345234532452345,],[10,9,8,7,6,3,5,6,7,8]),
					},
					{
						getDescription: () => `${'fakeInterface.evaluateMany(address,uint,uint[],uint[],uint8[]) - short'}`,
						getData: () => contracts.fakeInterface.contract.evaluateMany.getData(fakeAddress,897293847234,[2239234,234,23423423,11121212,],[2239234,234,23423423,11121212,],[22,55,11,111,]),
					},
				]
				
				for (const dataTemp of data) {
					for (const thirdpartiesTemp of thirdPartyOwners) {
						const dataItem = dataTemp
						const thirdparties = thirdpartiesTemp

						describe(`invocation with dataItem ${dataItem.getDescription()} with ${thirdparties.length} thirdparty`, () => {
							let data
							let initTx
							let transactionId
							let confirmTx
							let snapshotId

							const sentEther = web3.toWei("1", "ether")
							let proxyBalanceBefore
							let oracleBalanceBefore

							before(async () => {
								await reverter.promisifySnapshot()
								snapshotId = reverter.snapshotId

								for (const thirdpartyOwner of thirdparties) {
									const tx = await userAccount.router.addThirdPartyOwner(thirdpartyOwner, { from: userAccount.address, })
									const transactionId = await customAsserts.assertMultisigSubmitPresence({ tx, userProxy: userAccount.proxy, user: userAccount.address, })
									await userAccount.router.confirmTransaction(transactionId, { from: users.oracle, })
								}

								data = dataItem.getData()
								{
									const { external: inputDataExternalGas, contract: customInputDataGas, } = bytesChecker.inputDataGas(data.slice(2))
									const { length: totalBytes, nonZeroBytes, } = bytesChecker.countBytesInString(data.slice(2))
									console.log(`
									Data:
									# input data calc: ${inputDataExternalGas}
									# contract input data calc: ${customInputDataGas}
									# total bytes: ${totalBytes} / ${nonZeroBytes}
									`)
								}
								await contracts.mock.expect(
									userAccount.proxyAddress,
									0,
									data,
									customReturn
								)

								await asyncWeb3.sendEth({ from: userAccount.address, to: userAccount.proxyAddress, value: sentEther, })
								proxyBalanceBefore = await asyncWeb3.getEthBalance(userAccount.proxyAddress)
								oracleBalanceBefore = await asyncWeb3.getEthBalance(users.oracle)
							})

							after(async () => {
								await reverter.promisifyRevert(snapshotId)
							})
			
							it("should NOT have a payment for initial 'forward", async () => {
								initTx = await userAccount.router.forward(contracts.mock.address, data, 0, true, { from: userAccount.address, })
								await customAsserts.assertExpectations(1, 0)
								transactionId = await customAsserts.assertMultisigSubmitPresence({ tx: initTx, userProxy: userAccount.proxy, user: userAccount.address, })
							})
			
							it("should have a payment after oracle's confirmation", async () => {
								confirmTx = await userAccount.router.confirmTransaction(transactionId, { from: users.oracle, })
								await customAsserts.assertMultisigExecutionPresence({
									tx: confirmTx,
									transactionId,
									userRouter: userAccount.router,
									oracle: users.oracle,
								})
								await customAsserts.assertExpectations(0, 1)
							})
			
							it("should have payed back results", async () => {
								const fullTx = await asyncWeb3.getTx(confirmTx.tx)
								const txRealGas = (await asyncWeb3.getTxReceipt(confirmTx.tx)).gasUsed
								const txRealExpenses = await asyncWeb3.getTxExpences(confirmTx.tx)
								const proxyBalanceAfter = await asyncWeb3.getEthBalance(userAccount.proxyAddress)
								const oracleBalanceAfter = await asyncWeb3.getEthBalance(users.oracle)

								const cashbackValue = await proxyBalanceBefore.sub(proxyBalanceAfter)
								const cashbackGas = cashbackValue.div(fullTx.gasPrice)
								const cashbackOverpricedAbsolute = cashbackValue.sub(txRealExpenses)
								const cashbackOverpricedPercent = cashbackOverpricedAbsolute.div(txRealExpenses).mul(100)

								console.log(`
								# - gas price: ${fullTx.gasPrice}
								# - gas used: ${txRealGas}
								# - gas calculated: ${cashbackGas.toNumber()}
								# - % of overpayment: ${cashbackOverpricedPercent.toNumber().toFixed(2)}
								# - absolute overpayment: ${cashbackGas.sub(txRealGas).toNumber()}
								# - oracle received back: ${web3.fromWei((oracleBalanceAfter.sub(oracleBalanceBefore)), "ether")}
								`)
								// # Before:
								// # - proxy balance: ${proxyBalanceBefore.toString()}
								// # - oracle balance: ${oracleBalanceBefore.toString()}
								// # --------
								// # - real tx expenses: ${txRealExpenses.toString()}
								// # - cashback value: ${cashbackValue.toString()}
								// # - earning by oracle: ${oracleBalanceAfter.sub(oracleBalanceBefore).toString()}

								assert.isAtLeast(cashbackValue.toNumber(), txRealExpenses.toNumber(), "Cashback doesn't cover tx expenses of an oracle")
								assert.isAtMost(cashbackOverpricedPercent.toNumber(), 0.1, `Cashback shouldn't exceed real expenses more than for max percent`)
								assert.isAtMost(cashbackGas.sub(txRealGas).toNumber(), 200, `Cashback return gas shouldn't exceed spent gas greater than on 200 gas`)
							})
						})
					}
				}
			}

			///

			{
				const data = [
					{
						id: 1,
						description: `userInterface.set2FA(bool)`,
						executeInitial: async () => {
							return await userAccount.router.set2FA(false, { from: userAccount.address, })
						},
						getData: () => userAccount.router.contract.set2FA.getData(false),
					},
					{
						id: 2,
						description: `userInterface.setOracle(address)`,
						executeInitial: async () => {
							return await userAccount.router.setOracle(fakeAccountAddress, { from: userAccount.address, })
						},
						getData: () => userAccount.router.contract.setOracle.getData(fakeAccountAddress),
					},
					// {
					// 	id: 3,
					// 	description: `userInterface.setUserProxy(address)`,
					// 	executeInitial: async () => {
					// 		return await userAccount.router.setUserProxy(fakeAddress, { from: userAccount.address, })
					// 	},
					// 	getData: () => userAccount.router.contract.setUserProxy.getData(fakeAddress),
					// },
					{
						id: 4,
						description: `userInterface.addThirdPartyOwner(address)`,
						executeInitial: async () => {
							return await userAccount.router.addThirdPartyOwner(fakeAddress, { from: userAccount.address, })
						},
						getData: () => userAccount.router.contract.addThirdPartyOwner.getData(fakeAddress),
					},
					{
						id: 5,
						description: `userInterface.revokeThirdPartyOwner(address)`,
						executeInitial: async () => {
							{
								const initTx = await userAccount.router.addThirdPartyOwner(fakeAddress, { from: userAccount.address, })
								const transactionId = await customAsserts.assertMultisigSubmitPresence({ tx: initTx, userProxy: userAccount.proxy, user: userAccount.address, })
								const confirmTx = await userAccount.router.confirmTransaction(transactionId, { from: users.oracle, })
								await customAsserts.assertMultisigExecutionPresence({
									tx: confirmTx,
									transactionId,
									userRouter: userAccount.router,
									oracle: users.oracle,
								})
							}
							return await userAccount.router.revokeThirdPartyOwner(fakeAddress, { from: userAccount.address, })
						},
						getData: () => userAccount.router.contract.revokeThirdPartyOwner.getData(fakeAddress),
					},
					{
						id: 6,
						description: `userInterface.setRecoveryContract(address)`,
						executeInitial: async () => {
							return await userAccount.router.setRecoveryContract(fakeAccountAddress, { from: userAccount.address, })
						},
						getData: () => userAccount.router.contract.setRecoveryContract.getData(fakeAccountAddress),
					},
				]

				for (const dataItem of data) {
					describe.only(`userBackend methods ${dataItem.id} for ${dataItem.description}`, () => {
						const injectedDataItem = dataItem
						let initTx
						let transactionId
						let confirmTx
						let snapshotId

						const sentEther = web3.toWei("1", "ether")
						let proxyBalanceBefore
						let oracleBalanceBefore

						before(async () => {
							await reverter.promisifySnapshot()
							snapshotId = reverter.snapshotId

							// for (const thirdpartyOwner of thirdparties) {
							// 	const tx = await userAccount.router.addThirdPartyOwner(thirdpartyOwner, { from: userAccount.address, })
							// 	const transactionId = await customAsserts.assertMultisigSubmitPresence({ tx, userProxy: userAccount.proxy, user: userAccount.address, })
							// 	await userAccount.router.confirmTransaction(transactionId, { from: users.oracle, })
							// }

							const data = injectedDataItem.getData()
							{
								const { external: inputDataExternalGas, contract: customInputDataGas, } = bytesChecker.inputDataGas(data.slice(2))
								const { length: totalBytes, nonZeroBytes, } = bytesChecker.countBytesInString(data.slice(2))
								console.log(`
								Data:
								# input data calc: ${inputDataExternalGas}
								# contract input data calc: ${customInputDataGas}
								# total bytes: ${totalBytes} / ${nonZeroBytes}
								`)
							}

							await asyncWeb3.sendEth({ from: userAccount.address, to: userAccount.proxyAddress, value: sentEther, })
						})
						
						after(async () => {
							await reverter.promisifyRevert(snapshotId)
						})
						
						it("initial invocation is successful", async () => {
							initTx = await injectedDataItem.executeInitial()
							transactionId = await customAsserts.assertMultisigSubmitPresence({ tx: initTx, userProxy: userAccount.proxy, user: userAccount.address, })
							
							proxyBalanceBefore = await asyncWeb3.getEthBalance(userAccount.proxyAddress)
							oracleBalanceBefore = await asyncWeb3.getEthBalance(users.oracle)
						})
						
						it("should have a payment after oracle's confirmation ", async () => {
							confirmTx = await userAccount.router.confirmTransaction(transactionId, { from: users.oracle, })
							await customAsserts.assertMultisigExecutionPresence({
								tx: confirmTx,
								transactionId,
								userRouter: userAccount.router,
								oracle: users.oracle,
							})
						})
						
						it("should have payed back results", async () => {
							const fullTx = await asyncWeb3.getTx(confirmTx.tx)
							const txRealGas = (await asyncWeb3.getTxReceipt(confirmTx.tx)).gasUsed
							const txRealExpenses = await asyncWeb3.getTxExpences(confirmTx.tx)
							const proxyBalanceAfter = await asyncWeb3.getEthBalance(userAccount.proxyAddress)
							const oracleBalanceAfter = await asyncWeb3.getEthBalance(users.oracle)
	
							const cashbackValue = await proxyBalanceBefore.sub(proxyBalanceAfter)
							const cashbackGas = cashbackValue.div(fullTx.gasPrice)
							const cashbackOverpricedAbsolute = cashbackValue.sub(txRealExpenses)
							const cashbackOverpricedPercent = cashbackOverpricedAbsolute.div(txRealExpenses).mul(100)
	
							const event = (await eventHelpers.findEvent([userAccount.router, contracts.userBackend,], confirmTx, "LogEstimated"))[0]
							console.log(`
							# - gas price: ${fullTx.gasPrice}
							# - gas used: ${txRealGas}
							# - gas calculated: ${cashbackGas.toNumber()}
							# - % of overpayment: ${cashbackOverpricedPercent.toNumber().toFixed(2)}
							# - absolute overpayment: ${cashbackGas.sub(txRealGas).toNumber()}
							# - oracle received back: ${web3.fromWei((oracleBalanceAfter.sub(oracleBalanceBefore)), "ether")}
							### log estimated: ${event.args._calldatasize} / ${event.args._result}
							`)
							// # Before:
							// # - proxy balance: ${proxyBalanceBefore.toString()}
							// # - oracle balance: ${oracleBalanceBefore.toString()}
							// # --------
							// # - real tx expenses: ${txRealExpenses.toString()}
							// # - cashback value: ${cashbackValue.toString()}
							// # - earning by oracle: ${oracleBalanceAfter.sub(oracleBalanceBefore).toString()}
	
							assert.isAtLeast(cashbackValue.toNumber(), txRealExpenses.toNumber(), "Cashback doesn't cover tx expenses of an oracle")
							assert.isAtMost(cashbackOverpricedPercent.toNumber(), 0.1, `Cashback shouldn't exceed real expenses more than for max percent`)
							assert.isAtMost(cashbackGas.sub(txRealGas).toNumber(), 200, `Cashback return gas shouldn't exceed spent gas greater than on 200 gas`)
						})
					})
				}

			}

			describe("no ETH on proxy's address", () => {
				let dataProvider
				let snapshotId
				let initTx
				let transactionId
				let confirmTx

				let proxyBalanceBefore

				before(async () => {
					dataProvider = {
						getDescription: () => `${'userBackend.set2FA(bool)'}`,
						getData: () => contracts.userBackend.contract.set2FA.getData(true),
					}

					await reverter.promisifySnapshot()
					snapshotId = reverter.snapshotId

					await contracts.mock.expect(
						userAccount.proxyAddress,
						0,
						dataProvider.getData(),
						customReturn
					)

					proxyBalanceBefore = await asyncWeb3.getEthBalance(userAccount.proxyAddress)
				})

				after(async () => {
					await reverter.promisifyRevert(snapshotId)
				})

				it("should 2FA be 'on'", async () => {
					assert.isTrue(await userAccount.router.use2FA.call())
				})

				it("should allow for initial 'forward'", async () => {
					initTx = await userAccount.router.forward(contracts.mock.address, dataProvider.getData(), 0, true, { from: userAccount.address, })
					await customAsserts.assertExpectations(1, 0)
					transactionId = await customAsserts.assertMultisigSubmitPresence({ tx: initTx, userProxy: userAccount.proxy, user: userAccount.address, })
				})

				it("should NOT allow to execute on oracle's confirmation", async () => {
					confirmTx = await userAccount.router.confirmTransaction(transactionId, { from: users.oracle, })
					await customAsserts.assertMultisigExecutionFailure({
						tx: confirmTx,
						transactionId,
						userRouter: userAccount.router,
						oracle: users.oracle,
					})
					await customAsserts.assertExpectations(1, 0)

					const proxyBalanceAfter = await asyncWeb3.getEthBalance(userAccount.proxyAddress)
					assert.equal(proxyBalanceBefore.toString(16), proxyBalanceAfter.toString(16), "Proxy balance should not change")
				})
			})
		})
	})
	
	context("cashback = 'off'", () => {

		context("2FA = 'on' (one of default states and already tested)", () => {})

		context("2FA = 'off' (one of default states and already tested)", () => {})
	})

})