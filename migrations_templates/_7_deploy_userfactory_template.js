"use strict"
const UserFactory = artifacts.require('UserFactory')
const Roles2Library = artifacts.require('Roles2Library')
const { basename, } = require("path")

module.exports = deployer => {
	deployer.then(async () => {
		await deployer.deploy(UserFactory, Roles2Library.address)

		console.info("[MIGRATION] [" + parseInt(basename(__filename)) + "] User Factory: #deployed")
	})
}