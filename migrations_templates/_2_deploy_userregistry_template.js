"use strict"
const UserRegistry = artifacts.require('UserRegistry')
const Storage = artifacts.require('Storage')
const Roles2Library = artifacts.require('Roles2Library')
const { basename, } = require("path")

module.exports = deployer => {
	deployer.then(async () => {
		await deployer.deploy(UserRegistry, Storage.address, "UserRegistry", Roles2Library.address)

		console.info("[MIGRATION] [" + parseInt(basename(__filename)) + "] User Registry: #deployed")
	})
}