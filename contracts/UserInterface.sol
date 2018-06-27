/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.21;


import "./MultiSig.sol";


contract UserInterface is MultiSig {
    function init(address _oracle) external returns (uint);
    function getUserProxy() external view returns (address);
    function setUserProxy(address _userProxy) external returns (uint);
    function use2FA() external view returns (bool);
    function set2FA(bool _enabled) external returns (uint);
    function getOracle() external view returns (address);
    function setOracle(address _oracle) external returns (uint);
    function updateBackend(address _newBackend) external returns (uint);
    function setRecoveryContract(address _recovery) external returns (uint);
    function getRecoveryContract() external view returns (address);
    function recoverUser(address _newAddess) external returns (uint);
    function forward(
        address _destination,
        bytes _data,
        uint _value,
        bool _throwOnFailedCall
        ) external returns (bytes32);
}
