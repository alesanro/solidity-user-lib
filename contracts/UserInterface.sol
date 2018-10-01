/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.21;


import "./ThirdPartyMultiSig.sol";
import "./UserEmitter.sol";


/// @title Interface of a User that is created by UserFactory. Supports multisig operations.
contract UserInterface is ThirdPartyMultiSig, UserEmitter {
    function init(address _oracle, bool _enable2FA, address[] _thirdparties) external returns (uint);
    function getUserProxy() external view returns (address);
    function setUserProxy(address _userProxy) external returns (uint);
    function use2FA() external view returns (bool);
    function set2FA(bool _enabled) external returns (uint);
    function setOracle(address _oracle) external returns (uint);
    function addThirdPartyOwner(address _owner) external returns (uint);
    function revokeThirdPartyOwner(address _owner) external returns (uint);
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
        bytes32[3] _signerParams
        ) external returns (bytes32);
}
