/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.21;


import "./UserProxy.sol";
import "./UserBackendProviderInterface.sol";


/// @title Duplicates structure of Owned contract in order to save memory layout for
/// UserRouter and other delegatecall-based contracts (BaseByzantiumRouter)
contract UserOwned {
    address internal contractOwner;
    address internal pendingContractOwner;
}


/// @title Used to provide memory layout for UserRouter 
/// and book an order of properties and an ability to combine with UserOwned contract
contract UserBase {
    UserBackendProviderInterface public backendProvider;
    address public issuer;
    UserProxy internal userProxy;
    address internal recoveryContract;
    bool public use2FA;
}