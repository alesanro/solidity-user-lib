/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.21;


import "./BaseByzantiumRouter.sol";
import "./UserBase.sol";


contract UserRouter is BaseByzantiumRouter, UserOwned, UserBase {

    constructor(address _owner, address _recoveryContract, address _backendProvider) 
    public
    {
        require(_backendProvider != 0x0);

        userProxy = new UserProxy();
        contractOwner = _owner;
        issuer = msg.sender;
        recoveryContract = _recoveryContract;
        backendProvider = UserBackendProviderInterface(_backendProvider);
    }

    function implementation()
    internal
    view 
    returns (address) {
        return backendProvider.getUserBackend();
    }
}
