/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.21;


import "./MultiSig.sol";


/// @title Interface of a User that is created by UserFactory. Supports multisig operations.
contract UserInterface is MultiSig {
    function init(address _oracle, bool _enable2FA) external returns (uint);
    function getUserProxy() external view returns (address);
    function setUserProxy(address _userProxy) external returns (uint);
    function use2FA() external view returns (bool);
    function set2FA(bool _enabled) external returns (uint);
    function getOracle() external view returns (address);
    function setOracle(address _oracle) external returns (uint);
    function updateBackendProvider(address _newBackend) external returns (uint);
    function setRecoveryContract(address _recovery) external returns (uint);
    function getRecoveryContract() external view returns (address);
    function recoverUser(address _newAddess) external returns (uint);
    function forward(
        address _destination,
        bytes _data,
        uint _value,
        bool _throwOnFailedCall
        ) external returns (bytes32);
    function forwardWithVRS(
        address _destination,
        bytes _data,
        uint _value,
        bool _throwOnFailedCall,
        bytes _pass,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
        ) external returns (bytes32);
}
