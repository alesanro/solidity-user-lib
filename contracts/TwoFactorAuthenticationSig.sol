/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.21;


import "./MultiSig.sol";


contract TwoFactorAuthenticationSig is MultiSig {

    function _init(address _initiator, address _oracle)
    internal
    {
        uint _required = 2;
        address[] memory _owners = new address[](_required);
        _owners[0] = _initiator;
        _owners[1] = _oracle;
        MultiSig._initMultiSig(_owners, _required);
    }

    function _setOracle(address _oracle)
    internal
    {
        require(_oracle != 0x0);
        
        this.replaceOwner(owners[1], _oracle);
    }

    function getOracle()
    public
    view
    returns (address) 
    {
        return owners[1];
    }
}