/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.21;


import "solidity-roles-lib/contracts/Roles2LibraryAdapter.sol";


/// @title Plays role of a provider of user-related services
contract UserBackendProvider is Roles2LibraryAdapter {

    uint constant OK = 1;

    /// @dev Address of user backend
    address private userBackend;
    /// @dev Address of user registry
    address private userRegistry;

    function UserBackendProvider(address _roles2Library) Roles2LibraryAdapter(_roles2Library) public {
    }

    /// @notice Gets address of current user backend contract
    /// @return user backend contract address
    function getUserBackend() 
    public 
    view 
    returns (address) 
    {
        return userBackend;
    }

    /// @notice Sets up a new version of user backend. Will be available immediately for every
    /// user backend provider consumers.
    /// Allowed only for authorized roles.
    /// @param _userBackend new address of user backend
    /// @return result of an operation
    function setUserBackend(address _userBackend)
    external
    auth
    returns (uint)
    {
        require(_userBackend != 0x0);

        userBackend = _userBackend;
        return OK;
    }

    /// @notice Gets address of current user registry contract
    /// @return user registry contract address
    function getUserRegistry()
    public
    view
    returns (address)
    {
        return userRegistry;
    }

    /// @notice Sets up a new version of user registry. Will be available immediately for every
    /// user backend provider consumers.
    /// Allowed only for authorized roles.
    /// @param _userRegistry new address of user registry
    /// @return result of an operation
    function setUserRegistry(address _userRegistry)
    external
    auth
    returns (uint)
    {
        userRegistry = _userRegistry;
        return OK;
    }
}