const UserRegistry = artifacts.require("UserRegistry")
const Roles2Library = artifacts.require("Roles2Library")
const Storage = artifacts.require("Storage")
const StorageManager = artifacts.require("StorageManager")
const Owned = artifacts.require("Owned")
const Mock = artifacts.require("Mock")

const Reverter = require("./helpers/reverter")
const ErrorScope = require("../common/errors")
const eventHelpers = require("./helpers/eventsHelper")
const utils = require("./helpers/utils")


contract("User Registry", accounts => {
	const reverter = new Reverter(web3)

	const users = {
		contractOwner: accounts[0],
		rootUser: accounts[0],
		user1: accounts[1],
		user2: accounts[2],
		user3: accounts[3],
		oracle: accounts[7],
		recovery: accounts[8],
	}

	const contracts = {
		storage: null,
		storageManager: null,
		userRegistry: null,
		rolesLibrary: null,
		mock: null,
		ownedMock: null,
		userRegistryEventsHistory: null,
	}

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

	before("setup", async () => {
		await reverter.promisifySnapshot()

		contracts.storage = await Storage.new({ from: users.contractOwner, })
		contracts.storageManager = await StorageManager.new({ from: users.contractOwner, })
		await contracts.storageManager.setupEventsHistory(contracts.storageManager.address, { from: users.contractOwner, })
		await contracts.storage.setManager(contracts.storageManager.address, { from: users.contractOwner, })
		
		contracts.rolesLibrary = await Roles2Library.new(contracts.storage.address, "RolesLib", { from: users.contractOwner, })
		await contracts.storageManager.giveAccess(contracts.rolesLibrary.address, "RolesLib", { from: users.contractOwner, })
		await contracts.rolesLibrary.setRootUser(users.rootUser, true, { from: users.contractOwner, })
		await contracts.rolesLibrary.setupEventsHistory(contracts.rolesLibrary.address, { from: users.contractOwner, })

		contracts.userRegistry = await UserRegistry.new(contracts.storage.address, "UserRegistry", contracts.rolesLibrary.address, { from: users.contractOwner, })
		await contracts.storageManager.giveAccess(contracts.userRegistry.address, "UserRegistry", { from: users.contractOwner, })
		contracts.userRegistryEventsHistory = contracts.userRegistry
		await contracts.userRegistry.setupEventsHistory(contracts.userRegistryEventsHistory.address, { from: users.rootUser, })

		contracts.mock = await Mock.new()
		contracts.ownedMock = await Owned.new({ from: users.contractOwner, })

		await reverter.promisifySnapshot()
	})

	after(async () => {
		await reverter.promisifyRevert(0)
	})

	describe("initial", () => {

		it("should get set up events history", async () => {
			assert.notEqual(await contracts.userRegistry.getEventsHistory.call(), utils.zeroAddress)
		})

		it("should THROW and NOT allow to set up 0x0 events history", async () => {
			await contracts.userRegistry.setupEventsHistory(utils.zeroAddress).then(assert.fail, () => true)
		})

		after(async () => {
			await reverter.promisifyRevert()
		})
	})

	context("protection by auth", () => {
		const caller = users.user1

		beforeEach(async () => {
			await contracts.userRegistry.setRoles2Library(contracts.mock.address, { from: users.contractOwner, })
		})

		afterEach(async () => {
			await reverter.promisifyRevert()
		})

		it("should present for setupEventsHistory function", async () => {
			const newEventsHistory = "0xffffffffffffffffffffffffffffffffffffffff"
			await contracts.mock.expect(
				contracts.userRegistry.address,
				0,
				contracts.rolesLibrary.contract.canCall.getData(
					caller,
					contracts.userRegistry.address,
					contracts.userRegistry.contract.setupEventsHistory.getData(0x0).slice(0,10)
				),
				await contracts.mock.convertUIntToBytes32(1) // 1 == true
			)
			assert.equal(
				(await contracts.userRegistry.setupEventsHistory.call(newEventsHistory, { from: caller, })).toString(16),
				ErrorScope.OK.toString(16)
			)

			await contracts.userRegistry.setupEventsHistory(newEventsHistory, { from: caller, })
			await assertExpectations()
		})

		it("should present for addUserContract function", async () => {
			await contracts.mock.expect(
				contracts.userRegistry.address,
				0,
				contracts.rolesLibrary.contract.canCall.getData(
					caller,
					contracts.userRegistry.address,
					contracts.userRegistry.contract.addUserContract.getData(0x0).slice(0,10)
				),
				await contracts.mock.convertUIntToBytes32(1) // 1 == true
			)

			await contracts.userRegistry.addUserContract(contracts.ownedMock.address, { from: caller, })
			await assertExpectations()
		})

		it("should NOT present for removeUserContract function", async () => {
			await contracts.mock.expect(
				contracts.userRegistry.address,
				0,
				contracts.rolesLibrary.contract.canCall.getData(
					caller,
					contracts.userRegistry.address,
					contracts.userRegistry.contract.removeUserContract.getData(0x0).slice(0,10)
				),
				await contracts.mock.convertUIntToBytes32(1) // 1 == true
			)

			await contracts.userRegistry.removeUserContract(contracts.ownedMock.address, { from: caller, })
			await assertExpectations(1, 0)
		})

		it("should present for removeUserContractFrom function", async () => {
			await contracts.mock.expect(
				contracts.userRegistry.address,
				0,
				contracts.rolesLibrary.contract.canCall.getData(
					caller,
					contracts.userRegistry.address,
					contracts.userRegistry.contract.removeUserContractFrom.getData(0x0, 0x0).slice(0,10)
				),
				await contracts.mock.convertUIntToBytes32(1) // 1 == true
			)

			await contracts.userRegistry.removeUserContractFrom(contracts.ownedMock.address, 0x0, { from: caller, })
			await assertExpectations()
		})

		it("should NOT present for userOwnershipChanged function", async () => {
			await contracts.mock.expect(
				contracts.userRegistry.address,
				0,
				contracts.rolesLibrary.contract.canCall.getData(
					caller,
					contracts.userRegistry.address,
					contracts.userRegistry.contract.userOwnershipChanged.getData(0x0, 0x0).slice(0,10)
				),
				await contracts.mock.convertUIntToBytes32(1) // 1 == true
			)

			await contracts.userRegistry.userOwnershipChanged(contracts.ownedMock.address, caller, { from: caller, })
			await assertExpectations(1, 0)
		})
	})


	const stubAuthForAddUserContract = async (callerAccount, success = true) => {
		await contracts.mock.expect(
			contracts.userRegistry.address,
			0,
			contracts.rolesLibrary.contract.canCall.getData(
				callerAccount,
				contracts.userRegistry.address,
				contracts.userRegistry.contract.addUserContract.getData(0x0).slice(0,10)
			),
			await contracts.mock.convertUIntToBytes32(success ? 1 : 0)
		)
	}

	const stubAuthForRemoveUserContract = async (callerAccount, success = true) => {
		await contracts.mock.expect(
			contracts.userRegistry.address,
			0,
			contracts.rolesLibrary.contract.canCall.getData(
				callerAccount,
				contracts.userRegistry.address,
				contracts.userRegistry.contract.removeUserContractFrom.getData(0x0, 0x0).slice(0,10)
			),
			await contracts.mock.convertUIntToBytes32(success ? 1 : 0)
		)
	}

	context("edit and", () => {
		const moderator = users.user2

		describe("add user contract", () => {

			describe("for allowed caller", () => {

				before(async () => {
					await contracts.userRegistry.setRoles2Library(contracts.mock.address, { from: users.contractOwner, })
				})

				after(async () => {
					await reverter.promisifyRevert()
				})

				it("should NOT have user contract in user registry", async () => {
					assert.notInclude(await contracts.userRegistry.getUserContracts.call(users.contractOwner), contracts.ownedMock.address)
				})

				it("should allow to add user contract for the first time with OK code", async () => {
					await stubAuthForAddUserContract(moderator)
					assert.equal(
						(await contracts.userRegistry.addUserContract.call(contracts.ownedMock.address, { from: moderator, })).toString(16),
						ErrorScope.OK.toString(16)
					)
				})

				it("should allow to add user contract for the first time", async () => {
					const tx = await contracts.userRegistry.addUserContract(contracts.ownedMock.address, { from: moderator, })
					assert.include(await contracts.userRegistry.getUserContracts.call(users.contractOwner), contracts.ownedMock.address)
					{
						const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "UserContractAdded"))[0]
						assert.isDefined(event)
						assert.equal(event.address, contracts.userRegistryEventsHistory.address)
						assert.equal(event.args.self, contracts.userRegistry.address)
						assert.equal(event.args.userContract, contracts.ownedMock.address)
						assert.equal(event.args.owner, users.contractOwner)
					}
				})

				it("should NOT allow to add user contract when it exists with USER_REGISTRY_USER_CONTRACT_ALREADY_EXISTS code", async () => {
					await stubAuthForAddUserContract(moderator)
					assert.equal(
						(await contracts.userRegistry.addUserContract.call(contracts.ownedMock.address, { from: moderator, })).toString(16),
						ErrorScope.USER_REGISTRY_USER_CONTRACT_ALREADY_EXISTS.toString(16)
					)
				})
			})

			describe("for not allowed caller", () => {
				const notAuthorizedUser = users.user1

				before(async () => {
					await contracts.userRegistry.setRoles2Library(contracts.mock.address, { from: users.contractOwner, })
				})

				after(async () => {
					await reverter.promisifyRevert()
				})

				it("should NOT have user contract in user registry", async () => {
					assert.notInclude(await contracts.userRegistry.getUserContracts.call(users.contractOwner), contracts.ownedMock.address)
				})

				it("should not allow to add user contract with UNAUTHORIZED code", async () => {
					await stubAuthForAddUserContract(notAuthorizedUser, false)
					assert.equal(
						(await contracts.userRegistry.addUserContract.call(contracts.ownedMock.address, { from: notAuthorizedUser, })).toString(16),
						ErrorScope.UNAUTHORIZED.toString(16)
					)
				})

				it("should NOT allow to add user contract", async () => {
					const tx = await contracts.userRegistry.addUserContract(contracts.ownedMock.address, { from: notAuthorizedUser, })
					assert.notInclude(await contracts.userRegistry.getUserContracts.call(users.contractOwner), contracts.ownedMock.address)
					{
						{
							const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "UserContractAdded"))[0]
							assert.isUndefined(event)
						}
						{
							const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "AuthFailedError"))[0]
							assert.isDefined(event)
						}
					}
				})
			})
		})

		describe("remove user contract", () => {

			describe("for allowed caller", () => {

				before(async () => {
					await contracts.userRegistry.setRoles2Library(contracts.mock.address, { from: users.contractOwner, })
					await stubAuthForAddUserContract(moderator)
					await contracts.userRegistry.addUserContract(contracts.ownedMock.address, { from: moderator, })
				})

				after(async () => {
					await reverter.promisifyRevert()
				})

				it("should have user contract in user registry", async () => {
					assert.include(await contracts.userRegistry.getUserContracts.call(users.contractOwner), contracts.ownedMock.address)
				})

				it("should allow to remove existed user contract with OK code", async () => {
					await stubAuthForRemoveUserContract(moderator)
					assert.equal(
						(await contracts.userRegistry.removeUserContractFrom.call(contracts.ownedMock.address, users.contractOwner, { from: moderator, })).toString(16),
						ErrorScope.OK.toString(16)
					)
				})

				it("should allow to remove user contract", async () => {
					const tx = await contracts.userRegistry.removeUserContractFrom(contracts.ownedMock.address, users.contractOwner, { from: moderator, })
					assert.notInclude(await contracts.userRegistry.getUserContracts.call(users.contractOwner), contracts.ownedMock.address)
					{
						const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "UserContractRemoved"))[0]
						assert.isDefined(event)
						assert.equal(event.address, contracts.userRegistryEventsHistory.address)
						assert.equal(event.args.self, contracts.userRegistry.address)
						assert.equal(event.args.userContract, contracts.ownedMock.address)
						assert.equal(event.args.owner, users.contractOwner)
					}
				})

				it("should NOT allow to remove user contract twice with USER_REGISTRY_NO_USER_CONTRACT_FOUND code", async () => {
					await stubAuthForRemoveUserContract(moderator)
					assert.equal(
						(await contracts.userRegistry.removeUserContractFrom.call(contracts.ownedMock.address, users.contractOwner, { from: moderator, })).toString(16),
						ErrorScope.USER_REGISTRY_NO_USER_CONTRACT_FOUND.toString(16)
					)
				})
			})

			describe("for not allowed caller", () => {
				const notAuthorizedUser = users.user1

				before(async () => {
					await contracts.userRegistry.setRoles2Library(contracts.mock.address, { from: users.contractOwner, })
					await stubAuthForAddUserContract(moderator)
					await contracts.userRegistry.addUserContract(contracts.ownedMock.address, { from: moderator, })
				})

				after(async () => {
					await reverter.promisifyRevert()
				})

				it("should have user contract in user registry", async () => {
					assert.include(await contracts.userRegistry.getUserContracts.call(users.contractOwner), contracts.ownedMock.address)
				})

				it("should NOT allow to remove user contract with UNAUTHORIZED code", async () => {
					await stubAuthForRemoveUserContract(notAuthorizedUser, false)
					assert.equal(
						(await contracts.userRegistry.removeUserContractFrom.call(contracts.ownedMock.address, users.contractOwner, { from: notAuthorizedUser, })).toString(16),
						ErrorScope.UNAUTHORIZED.toString(16)
					)
				})

				it("should NOT allow to remove user contract", async () => {
					const tx = await contracts.userRegistry.removeUserContractFrom(contracts.ownedMock.address, users.contractOwner, { from: notAuthorizedUser, })
					assert.include(await contracts.userRegistry.getUserContracts.call(users.contractOwner), contracts.ownedMock.address)
					{
						{
							const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "UserContractRemoved"))[0]
							assert.isUndefined(event)
						}
						{
							const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "AuthFailedError"))[0]
							assert.isDefined(event)
						}
					}
				})
			})
		})

		describe("update user contract", () => {
			const newOwner = users.user3

			describe("when user contract not in registry", () => {

				describe("by anyone", () => {

					it("should NOT have user contract in user registry", async () => {
						assert.notInclude(await contracts.userRegistry.getUserContracts.call(users.contractOwner), contracts.ownedMock.address)
						assert.notInclude(await contracts.userRegistry.getUserContracts.call(newOwner), contracts.ownedMock.address)
					})

					it("should NOT allow to change", async () => {
						const tx = await contracts.userRegistry.userOwnershipChanged(contracts.ownedMock.address, users.contractOwner, { from: moderator, })
						assert.notInclude(await contracts.userRegistry.getUserContracts.call(users.contractOwner), contracts.ownedMock.address)
						assert.notInclude(await contracts.userRegistry.getUserContracts.call(newOwner), contracts.ownedMock.address)
						{
							{
								const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "UserContractAdded"))[0]
								assert.isUndefined(event)
							}
							{
								const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "UserContractRemoved"))[0]
								assert.isUndefined(event)
							}
							{
								const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "UserContractChanged"))[0]
								assert.isUndefined(event)
							}
						}
					})
				})
			})

			describe("when user contract in registry", () => {

				describe("by anyone", () => {
					before(async () => {
						await contracts.userRegistry.setRoles2Library(contracts.mock.address, { from: users.contractOwner, })
						await stubAuthForAddUserContract(moderator)
						await contracts.userRegistry.addUserContract(contracts.ownedMock.address, { from: moderator, })
						await contracts.ownedMock.transferOwnership(newOwner, { from: users.contractOwner, })
					})

					after(async () => {
						await reverter.promisifyRevert()
					})

					it("should have user contract in user registry", async () => {
						assert.include(await contracts.userRegistry.getUserContracts.call(users.contractOwner), contracts.ownedMock.address)
						assert.notInclude(await contracts.userRegistry.getUserContracts.call(newOwner), contracts.ownedMock.address)
					})

					it("should allow to change", async () => {
						const tx = await contracts.userRegistry.userOwnershipChanged(contracts.ownedMock.address, users.contractOwner, { from: moderator, })
						assert.notInclude(await contracts.userRegistry.getUserContracts.call(users.contractOwner), contracts.ownedMock.address)
						assert.include(await contracts.userRegistry.getUserContracts.call(newOwner), contracts.ownedMock.address)
						{
							{
								const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "UserContractAdded"))[0]
								assert.isUndefined(event)
							}
							{
								const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "UserContractRemoved"))[0]
								assert.isUndefined(event)
							}
							{
								const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "UserContractChanged"))[0]
								assert.isDefined(event)
								assert.equal(event.address, contracts.userRegistryEventsHistory.address)
								assert.equal(event.args.self, contracts.userRegistry.address)
								assert.equal(event.args.userContract, contracts.ownedMock.address)
								assert.equal(event.args.oldOwner, users.contractOwner)
								assert.equal(event.args.owner, newOwner)
							}
						}
					})

					it("should NOT have effect for already added owner", async () => {
						const tx = await contracts.userRegistry.userOwnershipChanged(contracts.ownedMock.address, newOwner, { from: moderator, })
						{
							{
								const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "UserContractAdded"))[0]
								assert.isUndefined(event)
							}
							{
								const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "UserContractRemoved"))[0]
								assert.isUndefined(event)
							}
							{
								const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "UserContractChanged"))[0]
								assert.isUndefined(event)
							}
							{
								const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "ErrorCode"))[0]
								assert.isDefined(event)
								assert.equal(parseInt(event.args.errorCode).toString(16), ErrorScope.USER_REGISTRY_CANNOT_CHANGE_TO_THE_SAME_OWNER.toString(16))
							}
						}
					})

					it("should NOT allow to update user contract twice the same", async () => {
						const tx = await contracts.userRegistry.userOwnershipChanged(contracts.ownedMock.address, users.contractOwner, { from: moderator, })
						{
							const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "UserContractAdded"))[0]
							assert.isUndefined(event)
						}
						{
							const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "UserContractRemoved"))[0]
							assert.isUndefined(event)
						}
						{
							const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "UserContractChanged"))[0]
							assert.isUndefined(event)
						}
						{
							const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "ErrorCode"))[0]
							assert.isDefined(event)
							assert.equal(parseInt(event.args.errorCode).toString(16), ErrorScope.USER_REGISTRY_NO_USER_CONTRACT_FOUND.toString(16))
						}
					})
				})
			})

			describe("when user contract in registry for two owners", () => {

				before(async () => {
					await contracts.userRegistry.setRoles2Library(contracts.mock.address, { from: users.contractOwner, })
					await stubAuthForAddUserContract(moderator)
					await contracts.userRegistry.addUserContract(contracts.ownedMock.address, { from: moderator, })
					await contracts.ownedMock.transferOwnership(newOwner, { from: users.contractOwner, })
					await stubAuthForAddUserContract(moderator)
					await contracts.userRegistry.addUserContract(contracts.ownedMock.address, { from: moderator, })
				})

				after(async () => {
					await reverter.promisifyRevert()
				})

				it("should present for both owners", async () => {
					assert.include(await contracts.userRegistry.getUserContracts.call(users.contractOwner), contracts.ownedMock.address)
					assert.include(await contracts.userRegistry.getUserContracts.call(newOwner), contracts.ownedMock.address)
				})

				it("should not allow to change when back to previous owner", async () => {
					await contracts.ownedMock.transferOwnership(users.contractOwner, { from: newOwner, })
					const tx = await contracts.userRegistry.userOwnershipChanged(contracts.ownedMock.address, newOwner, { from: moderator, })
					assert.include(await contracts.userRegistry.getUserContracts.call(users.contractOwner), contracts.ownedMock.address)
					assert.notInclude(await contracts.userRegistry.getUserContracts.call(newOwner), contracts.ownedMock.address)
					{
						{
							const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "UserContractAdded"))[0]
							assert.isUndefined(event)
						}
						{
							const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "UserContractRemoved"))[0]
							assert.isDefined(event)
							assert.equal(event.address, contracts.userRegistryEventsHistory.address)
							assert.equal(event.args.self, contracts.userRegistry.address)
							assert.equal(event.args.userContract, contracts.ownedMock.address)
							assert.equal(event.args.owner, newOwner)
						}
						{
							const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "UserContractChanged"))[0]
							assert.isUndefined(event)
						}
						{
							const event = (await eventHelpers.findEvent([contracts.userRegistry,], tx, "ErrorCode"))[0]
							assert.isUndefined(event)
						}
					}
				})
			})

		})
	})

})