"use strict"
const Recovery = artifacts.require('Recovery')
const Roles2Library = artifacts.require('Roles2Library')
const { basename, } = require("path")

module.exports = deployer => {
	deployer.then(async () => {
		await deployer.deploy(Recovery, Roles2Library.address)

		console.info("[MIGRATION] [" + parseInt(basename(__filename)) + "] Recovery: #deployed")
	})
}