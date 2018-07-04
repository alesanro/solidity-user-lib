/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.21;


import "solidity-roles-lib/contracts/Roles2LibraryAdapter.sol";


/// @title TODO:
contract UserBackendProvider is Roles2LibraryAdapter {

    uint constant OK = 1;

    /// @dev TODO:
    address private userBackend;

    constructor(address _roles2Library) Roles2LibraryAdapter(_roles2Library) public {
    }

    /// @notice TODO:
    function getUserBackend() public view returns (address) {
        return userBackend;
    }

    /// @notice TODO:
    function setUserBackend(address _userBackend)
    auth
    external
    returns (uint)
    {
        require(_userBackend != 0x0, "UserBackend should not be equal to 0x0");

        userBackend = _userBackend;
        return OK;
    }
}