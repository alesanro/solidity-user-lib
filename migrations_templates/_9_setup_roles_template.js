"use strict"
const Roles2Library = artifacts.require("Roles2Library")
const UserFactory = artifacts.require("UserFactory") // TODO: should be any user's contract that uses Roles2LibraryAdapter as a base contract
const UserRegistry = artifacts.require("UserRegistry") // TODO: should be any user's contract that uses Roles2LibraryAdapter as a base contract
const { basename, } = require("path")

module.exports = (deployer, network, accounts) => {
	deployer.then(async () => {
		const Roles = {
			ADMIN: 2,
			MODERATOR: 4,
			USER: 11,
			USER_REGISTRY: 31,
		}

		const roles2Library = await Roles2Library.deployed()
		const userFactory = await UserFactory.deployed()
		const userRegistry = await UserRegistry.deployed()

		// NOTE: LEAVE UNCHANGED. Needed to allow UserFactory to access UserRegistry
		{
			{
				const sig = userRegistry.contract.addUserContract.getData(0x0).slice(0, 10)
				await roles2Library.addRoleCapability(Roles.USER_REGISTRY, userRegistry.address, sig)
			}
			{
				const sig = userRegistry.contract.removeUserContractFrom.getData(0x0, 0x0).slice(0, 10)
				await roles2Library.addRoleCapability(Roles.USER_REGISTRY, userRegistry.address, sig)
			}

			await roles2Library.addUserRole(userFactory.address, Roles.USER_REGISTRY)
		}

		// Examples
		/* eslint-disable no-constant-condition */
		if (false) {
			// Setup public capability - open protected function for any call
			{
				const sig = userFactory.contract.setRoles2Library.getData(0x0).slice(0, 10)
				await roles2Library.setPublicCapability(userFactory.address, sig, true)
			}


			// Allow only defined role to call protected functions
			{
				{
					const sig = userFactory.contract.setRoles2Library.getData(0x0).slice(0, 10)
					await roles2Library.addRoleCapability(Roles.ADMIN, userFactory.address, sig)
				}
				{
					const sig = userFactory.contract.setRoles2Library.getData(0x0).slice(0, 10)
					await roles2Library.addRoleCapability(Roles.MODERATOR, userFactory.address, sig)
				}
			}

			// Add one more user to a role
			{
				await roles2Library.addUserRole(accounts[0], Roles.USER)
			}
		}

		console.info("[MIGRATION] [" + parseInt(basename(__filename)) + "] System roles: #setup")
	})
}
