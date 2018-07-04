/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.21;


import "solidity-shared-lib/contracts/Owned.sol";
import "./TwoFactorAuthenticationSig.sol";
import "./UserBase.sol";


contract UserBackend is Owned, UserBase, TwoFactorAuthenticationSig {

    uint constant OK = 1;
    uint constant MULTISIG_ADDED = 3;

    bytes32 public version = "1.0.0";

    modifier onlyMultiowned(address _initiator) {
        require(_allowDelegateCall(), "Only delegatecall is allowed"); // make sure this is used by delegatecall

        if ((!use2FA && msg.sender == _initiator)
            || msg.sender == address(this)
        ) {
            _;
        }
        else if (use2FA && msg.sender == _initiator) {
            submitTransaction(address(this), msg.value, msg.data);
            assembly {
                mstore(0, 3) /// MULTISIG_ADDED
                return(0, 32)
            }
        }
    }

    modifier onlyRecoveryContract {
        if (recoveryContract == msg.sender) {
            _;
        }
    }

    modifier onlyIssuer {
        if (issuer == msg.sender) {
            _;
        }
    }

    modifier onlyCall {
        require(_allowDelegateCall(), "Only delegatecall is allowed");
        _;
    }

    function init(address _oracle) 
    onlyCall
    external
    returns (uint)
    {
        _init(contractOwner, _oracle);
        return OK;
    }

    function set2FA(bool _enabled)
    onlyCall
    onlyMultiowned(contractOwner)
    external
    returns (uint) 
    {
        require(getOracle() != 0x0, "Oracle must be set before 2FA activation");

        if (use2FA != _enabled) {
            use2FA = _enabled;
        }
        return OK;
    }

    function setUserProxy(UserProxy _userProxy) 
    onlyCall
    onlyMultiowned(contractOwner)
    public 
    returns (uint) 
    {
        userProxy = _userProxy;
        return OK;
    }

    function getUserProxy() 
    public 
    view 
    returns (address) 
    {
        return userProxy;
    }

    function setOracle(address _oracle)
    onlyCall
    onlyMultiowned(contractOwner)
    external
    returns (uint)
    {
        require(_oracle != 0x0, "Oracle address should not be 0x0");

        _setOracle(_oracle);
        return OK;
    }

    function updateBackend(address _newBackend)
    onlyCall
    onlyIssuer
    external
    returns (uint) {
        require(_newBackend != 0x0, "Backend should not be 0x0");

        backend = _newBackend;
        return OK;
    }

    function setRecoveryContract(address _recoveryContract) 
    onlyCall
    onlyMultiowned(contractOwner)
    public 
    returns (uint) 
    {
        require(_recoveryContract != 0x0, "Recovery contract address should not be 0x0");

        recoveryContract = _recoveryContract;
        return OK;
    }

    function getRecoveryContract()
    public
    view
    returns (address)
    {
        return recoveryContract;
    }

    function recoverUser(address newAddress) 
    onlyCall
    onlyRecoveryContract
    public
    returns (uint) 
    {
        require(newAddress != 0x0, "Recovered user should not be 0x0");

        address _oldContractOwner = contractOwner;
        contractOwner = newAddress;
        this.replaceOwner(_oldContractOwner, newAddress);

        return OK;
    }

    function forward(
        address _destination,
        bytes _data,
        uint _value,
        bool _throwOnFailedCall
    )
    onlyCall
    onlyMultiowned(contractOwner)
    public
    returns (bytes32) 
    {
        return userProxy.forward(_destination, _data, _value, _throwOnFailedCall);
    }

    function transferOwnership(address _newOwner) 
    public 
    onlyMultiowned(contractOwner)
    returns (bool _result) 
    {
        if (_allowDelegateCall()) {
            address _oldContractOwner = contractOwner;
            _result = super.transferOwnership(_newOwner);
            if (_result) {
                this.replaceOwner(_oldContractOwner, _newOwner);
            }

            return _result;
        } 

        return super.transferOwnership(_newOwner);
    }

    function changeContractOwnership(address _to)
    public
    onlyMultiowned(contractOwner)
    returns (bool)
    {
        return super.changeContractOwnership(_to);
    }

    function claimContractOwnership()
    public
    returns (bool _result)
    {
        if (_allowDelegateCall()) {
            address _oldContractOwner = contractOwner;
            _result = super.claimContractOwnership();
            if (_result) {
                this.replaceOwner(_oldContractOwner, contractOwner);
            }
            return _result;
        }

        return super.claimContractOwnership();
    }

    function _allowDelegateCall() private view returns (bool) {
        // make sure this is used by delegatecall
        return address(this) != backend && backend != 0x0; 
    }
}