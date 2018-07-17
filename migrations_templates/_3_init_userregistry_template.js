"use strict"
const UserRegistry = artifacts.require('UserRegistry')
const StorageManager = artifacts.require('StorageManager')
const Roles2Library = artifacts.require('Roles2Library')
const { basename, } = require("path")

module.exports = deployer => {
	deployer.then(async () => {
		const storageManager = await StorageManager.deployed()
		const userRegistry = await UserRegistry.deployed()

		await storageManager.giveAccess(userRegistry.address, "UserRegistry")

		// const eventsHistory = userRegistry // EventsHistory or MultiEventsHistory. See solidity-eventshistory-lib
		// await userRegistry.setupEventsHistory(eventsHistory.address)

		// NOTE: authorize or reject userRegistry in events history

		console.info("[MIGRATION] [" + parseInt(basename(__filename)) + "] User Registry: #initialized")
	})
}