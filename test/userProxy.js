"use strict"

const UserProxy = artifacts.require('UserProxy')
const UserProxyTester = artifacts.require('UserProxyTester')
const Mock = artifacts.require('Mock')

const Reverter = require('./helpers/reverter')
const eventHelpers = require("./helpers/eventsHelper")


contract('UserProxy', function(accounts) {
	const reverter = new Reverter(web3)

	const users = {
		contractOwner: accounts[0],
		user1: accounts[1],
	}
	const contracts = {
		userProxy: null,
		tester: null,
		mock: null,
	}
	let snapshotId

	before('setup', async () => {
		await reverter.promisifySnapshot()
		snapshotId = reverter.snapshotId

		contracts.userProxy = await UserProxy.new({ from: users.contractOwner, })
		contracts.tester = await UserProxyTester.new({ from: users.contractOwner, })
		contracts.mock = await Mock.new({ from: users.contractOwner, })

		await reverter.promisifySnapshot()
	})

	after(async () => {
		await reverter.promisifyRevert(snapshotId)
	})

	afterEach('revert', async () => {
		await reverter.promisifyRevert()
	})

	it('should forward calls', async () => {
		const someParameter = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
		const data = contracts.tester.contract.functionReturningValue.getData(someParameter)
		assert.equal(
			await contracts.userProxy.forward.call(contracts.tester.address, data, 0, false, { from: users.contractOwner, }),
			someParameter
		)
	})

	it('should NOT forward calls when called by not-owner', async () => {
		const someParameter = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
		const data = contracts.tester.contract.functionReturningValue.getData(someParameter)
		assert.equal(
			await contracts.userProxy.forward.call(contracts.tester.address, data, 0, false, { from: users.user1, }),
			0
		)
	})

	it('should throw with "throwOnFailedCall = true"', async () => {
		const someParameter = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
		const data = contracts.tester.contract.unsuccessfullFunction.getData(someParameter)
		await contracts.userProxy.forward(contracts.tester.address, data, 0, true, { from: users.contractOwner, }).then(assert.fail, () => true)
	})

	it('should NOT throw with "throwOnFailedCall = false"', async () => {
		const someParameter = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
		const data = contracts.tester.contract.unsuccessfullFunction.getData(someParameter)
		assert.equal(
			await contracts.userProxy.forward.call(contracts.tester.address, data, 0, false, { from: users.contractOwner, }),
			0
		)
	})

	it('should emit "Forwarded" event when forwarded', async () => {
		const someParameter = '0x3432000000000000000000000000000000000000000000000000000000000000'
		const data = contracts.tester.contract.functionReturningValue.getData(someParameter)
		const tx = await contracts.userProxy.forward(contracts.tester.address, data, 0, false, { from: users.contractOwner, })
		{
			const event = (await eventHelpers.findEvent([contracts.userProxy,], tx, "Forwarded"))[0]
			assert.isDefined(event)
			assert.equal(event.address, contracts.userProxy.address)
			assert.equal(event.name, 'Forwarded')
			assert.equal(event.args.destination, contracts.tester.address)
			assert.equal(event.args.value, 0)
			assert.equal(event.args.data, data)
		}
	})

	it("should emit 'Received' event when receives ether", async () => {
		const sendValue = web3.toWei("100", "gwei")
		const transactionHash = await (new Promise((resolve, reject) => {
			web3.eth.sendTransaction({
				from: users.contractOwner, to: contracts.userProxy.address, value: sendValue, gas: 100000,
			}, (e, r) => {
				(e === undefined || e === null) ? resolve(r) : reject(e)
			})
		}))

		const txReceipt = await (new Promise((resolve, reject) => {
			web3.eth.getTransactionReceipt(transactionHash, (e, r) => {
				(e === undefined || e === null) ? resolve(r) : reject(e)
			})
		}))
		const tx = { receipt: txReceipt, }
		{
			const event = (await eventHelpers.findEvent([contracts.userProxy,], tx, "Received"))[0]
			assert.isDefined(event)
			assert.equal(event.address, contracts.userProxy.address)
			assert.equal(event.name, 'Received')
			assert.equal(event.args.sender, users.contractOwner)
			assert.equal(event.args.value.toString(16), sendValue.toString(16))
		}
	})
})
