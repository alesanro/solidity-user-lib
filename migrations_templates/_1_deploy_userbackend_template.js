"use strict"
const UserBackend = artifacts.require('UserBackend')
const { basename, } = require("path")

module.exports = deployer => {
	deployer.then(async () => {
		await deployer.deploy(UserBackend)

		console.info("[MIGRATION] [" + parseInt(basename(__filename)) + "] User Backend: #deployed")
	})
}