/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.21;


import "solidity-shared-lib/contracts/Owned.sol";
import "solidity-roles-lib/contracts/Roles2LibraryAdapter.sol";
import "./UserInterface.sol";


contract Recovery is Roles2LibraryAdapter {

    uint constant RECOVERY_SCOPE = 19000;

    event UserRecovered(address prevUser, address newUser, UserInterface userContract);

    function Recovery(address _roles2Library) Roles2LibraryAdapter(_roles2Library) public {}

    function recoverUser(UserInterface _userContract, address _newAddress) 
    auth 
    public 
    returns (uint) 
    {
        address prev = Owned(_userContract).contractOwner();
        if (OK != _userContract.recoverUser(_newAddress)) {
            revert();
        }

        emit UserRecovered(prev, _newAddress, _userContract);
        return OK;
    }

}
