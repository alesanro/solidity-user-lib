"use strict"
const UserFactory = artifacts.require('UserFactory')
const UserBackendProvider = artifacts.require('UserBackendProvider')
const Recovery = artifacts.require('Recovery')
const { basename, } = require("path")

const ORACLE_ADDRESS = "" // TODO: MUST BE ORACLE ADDRESS

module.exports = deployer => {
	deployer.then(async () => {
		if (ORACLE_ADDRESS === "") {
			throw "Should set up oracle address"
		}

		const userFactory = await UserFactory.deployed()

		await userFactory.setUserBackendProvider(UserBackendProvider.address)
		await userFactory.setUserRecoveryAddress(Recovery.address)
		await userFactory.setOracleAddress(ORACLE_ADDRESS)

		console.info("[MIGRATION] [" + parseInt(basename(__filename)) + "] User Factory: #initialized")
	})
}