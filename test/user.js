const UserBackend = artifacts.require("UserBackend")
const BumpedUserBackend = artifacts.require("BumpedUserBackend")
const UserRouter = artifacts.require("UserRouter")
const UserProxy = artifacts.require("UserProxy")
const UserFactory = artifacts.require("UserFactory")
const UserInterface = artifacts.require("UserInterface")
const Roles2Library = artifacts.require("StubRoles2Library")
const Storage = artifacts.require("Storage")
const StorageManager = artifacts.require("StorageManager")
const Owned = artifacts.require("Owned")
const Mock = artifacts.require("Mock")

const Reverter = require("./helpers/reverter")
const ErrorScope = require("../common/errors")
const eventHelpers = require("./helpers/eventsHelper")
const utils = require("./helpers/utils")

contract("User Workflow", accounts => {

	const reverter = new Reverter(web3)

	const users = {
		contractOwner: accounts[0],
		user1: accounts[1],
		user2: accounts[2],
		user3: accounts[3],
		oracle: accounts[7],
		recovery: accounts[8],
	}

	const contracts = {
		storage: null,
		storageManager: null,
		userBackend: null,
		userFactory: null,
		rolesLibrary: null,
		mock: null,
	}

	const assertExpectations = async (expected = 0, callsCount = null) => {
		assert.equal((await contracts.mock.expectationsLeft()).toString(16), expected.toString(16))
		const expectationsCount = await contracts.mock.expectationsCount()
		assert.equal((await contracts.mock.callsCount()).toString(16), callsCount === null ? expectationsCount.toString(16) : callsCount.toString(16))
	}

	before("setup", async () => {
		await reverter.promisifySnapshot()

		contracts.storage = await Storage.new({ from: users.contractOwner, })
		contracts.storageManager = await StorageManager.new({ from: users.contractOwner, })
		await contracts.storage.setManager(contracts.storageManager.address, { from: users.contractOwner, })

		contracts.userBackend = await UserBackend.new({ from: users.contractOwner, })

		contracts.rolesLibrary = await Roles2Library.new(contracts.storage.address, "RolesLib", { from: users.contractOwner, })
		await contracts.storageManager.giveAccess(contracts.rolesLibrary.address, "RolesLib", { from: users.contractOwner, })
		await contracts.rolesLibrary.setRootUser(users.contractOwner, true, { from: users.contractOwner, })

		contracts.userFactory = await UserFactory.new(contracts.rolesLibrary.address, { from: users.contractOwner, })
		await contracts.userFactory.setUserBackend(contracts.userBackend.address, { from: users.contractOwner, })
		await contracts.userFactory.setOracleAddress(users.oracle, { from: users.contractOwner, })

		contracts.mock = await Mock.new()

		await reverter.promisifySnapshot()
	})

	after(async () => {
		await reverter.promisifyRevert(0)
	})

	context("initial state of", () => {

		after(async () => {
			await reverter.promisifyRevert()
		})

		describe("user factory", () => {
			it("should have pre-setup oracle", async () => {
				assert.equal(
					await contracts.userFactory.oracle(),
					users.oracle
				)
			})

			it("should have pre-setup backend", async () => {
				assert.equal(
					await contracts.userFactory.userBackend(),
					contracts.userBackend.address
				)
			})
		})

		describe("user backend", () => {
			it("should THROW and NOT allow to initialize UserBackend by direct call", async () => {
				await contracts.userBackend.init(users.oracle, { from: users.contractOwner, }).then(assert.fail, () => true)
			})

			it("should have 0x0 user proxy property", async () => {
				assert.equal(
					await contracts.userBackend.getUserProxy(),
					utils.zeroAddress
				)
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
				await contracts.userBackend.updateBackend(newBackend, { from: users.contractOwner, }).then(assert.fail, () => true)
			})
		})
	})

	context("creation", () => {
		const user = users.user1

		let userRouterAddress
		let userProxyAddress

		after(async () => {
			await reverter.promisifyRevert()
		})

		it("should be able to create a new user", async () => {
			const tx = await contracts.userFactory.createUserWithProxyAndRecovery(user, users.recovery, false, { from: user, })
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

		it("should THROW to initialize newly created user", async () => {
			await UserInterface.at(userRouterAddress).init(users.oracle, { from: user, }).then(assert.fail, () => true)
		})

		it("user should have issuer and backend", async () => {
			assert.equal(
				(await UserRouter.at(userRouterAddress).backend.call()),
				contracts.userBackend.address
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
			const data = contracts.userFactory.contract.createUserWithProxyAndRecovery.getData(user, users.recovery, false)
			await contracts.mock.expect(
				userProxyAddress,
				0,
				data,
				await contracts.mock.convertUIntToBytes32.call(ErrorScope.OK)
			)

			await UserInterface.at(userRouterAddress).forward(contracts.mock.address, data, 0, true, { from: user, }).then(() => true, assert.fail)
			await assertExpectations()
		})

		it("anyone should NOT be able to update recovery contract with UNAUTHORIZED code", async () => {
			const newRecovery = users.user3
			assert.equal(
				(await UserInterface.at(userRouterAddress).setRecoveryContract.call(newRecovery, { from: users.user3, })).toNumber(),
				ErrorScope.UNAUTHORIZED
			)
		})

		it("user should be able to update recovery contract with OK code", async () => {
			const newRecovery = users.user3
			assert.equal(
				(await UserInterface.at(userRouterAddress).setRecoveryContract.call(newRecovery, { from: user, })).toNumber(),
				ErrorScope.OK
			)
		})

		it("user should be able to update recovery contract", async () => {
			const newRecovery = users.user3
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

		it("anyone should NOT be able to update an oracle with UNAUTHORIZED code", async () => {
			const newOracle = users.user3
			assert.equal(
				(await UserInterface.at(userRouterAddress).setOracle.call(newOracle, { from: users.user3, })).toNumber(),
				ErrorScope.UNAUTHORIZED
			)
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
	})

	context("update", () => {
		const user = users.user1

		let userRouter
		let userProxy

		let snapshotId

		before(async () => {
			const tx = await contracts.userFactory.createUserWithProxyAndRecovery(user, users.recovery, false, { from: user, })
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
				const data = contracts.userFactory.contract.createUserWithProxyAndRecovery.getData(user, users.recovery, false)
				await contracts.mock.expect(
					userProxy.address,
					0,
					data,
					await contracts.mock.convertUIntToBytes32.call(ErrorScope.OK)
				)

				await userRouter.forward(contracts.mock.address, data, 0, true, { from: user, }).then(() => true, assert.fail)
				await assertExpectations(1)
			})

			it("and forward should go through a new proxy", async () => {
				const data = contracts.userFactory.contract.createUserWithProxyAndRecovery.getData(user, users.recovery, false)
				await contracts.mock.expect(
					newUserProxy.address,
					0,
					data,
					await contracts.mock.convertUIntToBytes32.call(ErrorScope.OK)
				)

				await userRouter.forward(contracts.mock.address, data, 0, true, { from: user, }).then(() => true, assert.fail)
				await assertExpectations()
			})
		})

		describe("backend", () => {

			let newUserBackend

			before(async () => {
				newUserBackend = await BumpedUserBackend.new({ from: users.contractOwner, })
			})

			after(async () => {
				await reverter.promisifyRevert()
			})

			it("and have up to date backend address", async () => {
				assert.equal(await UserRouter.at(userRouter.address).backend.call(), contracts.userBackend.address)
			})

			it("and should have different versions between the current and a new backend", async () => {
				assert.notEqual(
					await contracts.userBackend.version.call(),
					await newUserBackend.version.call()
				)
			})

			it("and forward function should NOT have 'BumpedUserBackendEvent' event emitted", async () => {
				const data = contracts.userFactory.contract.createUserWithProxyAndRecovery.getData(user, users.recovery, false)
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

			it("where anyone should NOT be able to update backend by himself with UNAUTHORIZED code", async () => {
				assert.equal(
					(await userRouter.updateBackend.call(newUserBackend.address, { from: users.user2, })).toNumber(),
					ErrorScope.UNAUTHORIZED
				)
			})

			it("where user should NOT be able to update backend by himself with UNAUTHORIZED code", async () => {
				assert.equal(
					(await userRouter.updateBackend.call(newUserBackend.address, { from: user, })).toNumber(),
					ErrorScope.UNAUTHORIZED
				)
			})

			it("and should have the same backend address in user factory", async () => {
				assert.equal(await contracts.userFactory.userBackend.call(), contracts.userBackend.address)
			})

			it("where issuer should NOT be able to update backend to the same version with USER_FACTORY_INVALID_BACKEND_VERSION code", async () => {
				assert.equal(
					(await contracts.userFactory.updateBackendForUser.call(userRouter.address, { from: users.contractOwner, })).toNumber(),
					ErrorScope.USER_FACTORY_INVALID_BACKEND_VERSION
				)
			})

			it("and base backend should be updated in user factory first", async () => {
				await contracts.userFactory.setUserBackend(newUserBackend.address, { from: users.contractOwner, })
				assert.equal(await contracts.userFactory.userBackend.call(), newUserBackend.address)
			})

			it("where issuer should be able to update backend to the newest version with OK code", async () => {
				assert.equal(
					(await contracts.userFactory.updateBackendForUser.call(userRouter.address, { from: users.contractOwner, })).toNumber(),
					ErrorScope.OK
				)
			})

			it("where issuer should be able to update backend to the newest version", async () => {
				await contracts.userFactory.updateBackendForUser(userRouter.address, { from: users.contractOwner, })
				assert.equal(await UserRouter.at(userRouter.address).backend.call(), newUserBackend.address)
			})

			it("and forward function should have 'BumpedUserBackendEvent' event emitted", async () => {
				const data = contracts.userFactory.contract.createUserWithProxyAndRecovery.getData(user, users.recovery, false)
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

		describe("2FA", () => {

			const assertNoMultisigPresence = async tx => {
				const notEmittedEvents = [
					"Confirmation",
					"Submission",
					"Execution",
				]
				const events = await eventHelpers.findEvents([contracts.userBackend,], tx, e => notEmittedEvents.indexOf(e) >= 0)
				assert.lengthOf(events, 0)
			}

			/// @return transactionId
			const assertMultisigSubmitPresence = async (tx, userOwner = user) => {
				let transactionId
				{
					const notEmittedEvents = [
						"Execution",
						"Forwarded",
					]
					const events = await eventHelpers.findEvents([ userProxy, contracts.userBackend, ], tx, e => notEmittedEvents.indexOf(e) >= 0)
					assert.lengthOf(events, 0)
				}
				{
					{
						const event = (await eventHelpers.findEvent([contracts.userBackend,], tx, "Submission"))[0]
						assert.isDefined(event)
						assert.isDefined(event.args.transactionId)

						transactionId = event.args.transactionId
					}
					{
						const event = (await eventHelpers.findEvent([contracts.userBackend,], tx, "Confirmation"))[0]
						assert.isDefined(event)
						assert.equal(event.args.sender, userOwner)
						assert.equal(event.args.transactionId.toString(16), transactionId.toString(16))
					}
				}

				return transactionId
			}

			const assertMultisigExecutionPresence = async (tx, transactionId, oracle = users.oracle) => {
				{
					const notEmittedEvents = [
						"Submission",
					]
					const events = await eventHelpers.findEvents([ userRouter, contracts.userBackend, ], tx, e => notEmittedEvents.indexOf(e) >= 0)
					assert.lengthOf(events, 0)
				}
				{
					{
						const event = (await eventHelpers.findEvent([contracts.userBackend,], tx, "Confirmation"))[0]
						assert.isDefined(event)
						assert.equal(event.args.sender, oracle)
						assert.equal(event.args.transactionId.toString(16), transactionId.toString(16))
					}
					{
						const event = (await eventHelpers.findEvent([contracts.userBackend,], tx, "Execution"))[0]
						assert.isDefined(event)
						assert.equal(event.args.transactionId.toString(16), transactionId.toString(16))
					}
				}
			}

			after(async () => {
				await reverter.promisifyRevert()
			})

			afterEach(async () => {
				await contracts.mock.resetCallsCount()
			})

			context("when it is disabled", () => {
				let data

				before(async () => {
					data = contracts.userFactory.contract.createUserWithProxyAndRecovery.getData(user, users.recovery, false)
				})

				after(async () => {
					await reverter.promisifyRevert()
				})

				it("by default should be 'false'", async () => {
					assert.isFalse(await userRouter.use2FA.call())
				})

				it("and should allow to call forward with 2FA = 'false' immediately", async () => {
					const data = contracts.userFactory.contract.createUserWithProxyAndRecovery.getData(user, users.recovery, false)
					await contracts.mock.expect(
						userProxy.address,
						0,
						data,
						await contracts.mock.convertUIntToBytes32.call(ErrorScope.OK)
					)

					const tx = await userRouter.forward(contracts.mock.address, data, 0, true, { from: user, }).then(r => r, assert.fail)
					await assertNoMultisigPresence(tx)
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
					await userRouter.set2FA(true, { from: user, })
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
					await assertExpectations(1, 0)
					transactionId = await assertMultisigSubmitPresence(tx)
				})

				it("and anyone THROW and should NOT able to confirm submitted transaction and execute forward call", async () => {
					await userRouter.confirmTransaction.call(transactionId, { from: users.user3, }).then(assert.fail, () => true)
				})

				it("and user THROW and should NOT able to confirm submitted by him transaction and execute forward call", async () => {
					await userRouter.confirmTransaction.call(transactionId, { from: user, }).then(assert.fail, () => true)
				})

				it("and oracle should confirm submitted transaction and execute forward call", async () => {
					const tx = await userRouter.confirmTransaction(transactionId, { from: users.oracle, }).then(r => r, assert.fail)
					await assertExpectations(0, 1)
					await assertMultisigExecutionPresence(tx, transactionId)
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
						transactionId = await assertMultisigSubmitPresence(tx)
					})

					it("should allow to confirm update of recovery contract by an oracle", async () => {
						const tx = await userRouter.confirmTransaction(transactionId, { from: users.oracle, })
						await assertMultisigExecutionPresence(tx, transactionId)
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
						await assertNoMultisigPresence(tx)
					})

					it("should have updated contract owner", async () => {
						assert.equal(await Owned.at(userRouter.address).contractOwner.call(), newUserOwner)
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
						transactionId = await assertMultisigSubmitPresence(tx)
					})

					it("should allow to confirm update of user proxy contract by an oracle", async () => {
						const tx = await userRouter.confirmTransaction(transactionId, { from: users.oracle, })
						await assertMultisigExecutionPresence(tx, transactionId)
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
						transactionId = await assertMultisigSubmitPresence(tx)
					})

					it("should allow to confirm update of oracle by an oracle", async () => {
						const tx = await userRouter.confirmTransaction(transactionId, { from: users.oracle, })
						await assertMultisigExecutionPresence(tx, transactionId)
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
						transactionId = await assertMultisigSubmitPresence(tx)
					})

					it("should THROW and NOT allow to confirm update of oracle by an old oracle", async () => {
						await userRouter.confirmTransaction(transactionId, { from: users.oracle, }).then(assert.fail, () => true)
					})

					it("should allow to confirm update of oracle by a new oracle", async () => {
						const tx = await userRouter.confirmTransaction(transactionId, { from: newOracleAddress, })
						await assertMultisigExecutionPresence(tx, transactionId, newOracleAddress)
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
						transactionId = await assertMultisigSubmitPresence(tx)
					})

					it("should allow to confirm update of 2FA contract by an oracle", async () => {
						const tx = await userRouter.confirmTransaction(transactionId, { from: users.oracle, })
						await assertMultisigExecutionPresence(tx, transactionId)
					})

					it("should have a changed 2FA address", async () => {
						assert.isFalse(await userRouter.use2FA.call())
					})
				})
			})

		})
	})
})