"use strict"
const UserBackendProvider = artifacts.require('UserBackendProvider')
const UserBackend = artifacts.require('UserBackend')
const UserRegistry = artifacts.require('UserRegistry')

const { basename, } = require("path")

module.exports = deployer => {
	deployer.then(async () => {
		const userBackendProvider = await UserBackendProvider.deployed()

		await userBackendProvider.seUserBackend(UserBackend.address)
		await userBackendProvider.seUserRegistry(UserRegistry.address)

		console.info("[MIGRATION] [" + parseInt(basename(__filename)) + "] User Backend Provider: #initialized")
	})
}