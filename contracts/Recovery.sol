/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.23;


import "solidity-shared-lib/contracts/Owned.sol";
import "solidity-roles-lib/contracts/Roles2LibraryAdapter.sol";
import "./UserInterface.sol";


/// @title Provides centralized point to recovery function through smart contract functionality.
/// Instead of using different recovery addresses for each user Recovery organizes moderated
/// way (with the help of Roles2Library contract) to recover users.
contract Recovery is Roles2LibraryAdapter {

    uint constant RECOVERY_SCOPE = 19000;

    event UserRecovered(address prevUser, address newUser, UserInterface userContract);

    constructor(address _roles2Library) Roles2LibraryAdapter(_roles2Library) public {}

    /// @notice Recovers provided user to a new contract owner
    /// Allowed only for authorized roles.
    /// Emits UserRecovered event.
    /// @param _userContract user contract address that is compatible with UserInterface interface
    /// @param _newAddress address of a new contract owner
    /// @return result of an operation
    function recoverUser(UserInterface _userContract, address _newAddress) 
    auth 
    public 
    returns (uint) 
    {
        address prev = Owned(_userContract).contractOwner();
        if (OK != _userContract.recoverUser(_newAddress)) {
            revert("Cannot recover to a new address");
        }

        emit UserRecovered(prev, _newAddress, _userContract);
        return OK;
    }

}
