/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.21;


import "./BaseByzantiumRouter.sol";
import "./UserBase.sol";


/// @title Provides lightweight frontend contract that uses delegatecall to pass
/// every function call to a shared library (backend) contract. 
/// Use UserInterface to make calls to this facade.
contract UserRouter is BaseByzantiumRouter, UserOwned, UserBase {

    /// @notice UserRouter constructor
    /// @param _owner owner of created contract
    /// @param _recoveryContract address of recovery account/contract
    /// @param _backendProvider address of backend provider; will be used to fetch current backend implementation
    constructor(address _owner, address _recoveryContract, address _backendProvider) 
    public
    {
        require(_owner != 0x0, "Owner should not be equal to 0x0");
        require(_backendProvider != 0x0, "Backend provider should not be equal to 0x0");

        userProxy = new UserProxy();
        contractOwner = _owner;
        issuer = msg.sender;
        recoveryContract = _recoveryContract;
        backendProvider = UserBackendProviderInterface(_backendProvider);
    }

    function implementation()
    internal
    view 
    returns (address) 
    {
        return backendProvider.getUserBackend();
    }
}
