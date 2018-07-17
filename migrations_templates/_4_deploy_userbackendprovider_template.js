"use strict"
const UserBackendProvider = artifacts.require('UserBackendProvider')
const Roles2Library = artifacts.require('Roles2Library')
const { basename, } = require("path")

module.exports = deployer => {
	deployer.then(async () => {
		await deployer.deploy(UserBackendProvider, Roles2Library.address)

		console.info("[MIGRATION] [" + parseInt(basename(__filename)) + "] User Backend Provider: #deployed")
	})
}