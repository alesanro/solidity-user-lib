/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.21;


import "solidity-shared-lib/contracts/Owned.sol";
import "./TwoFactorAuthenticationSig.sol";
import "./UserBase.sol";
import "./UserRegistry.sol";


contract UserBackend is Owned, UserBase, TwoFactorAuthenticationSig {

    uint constant OK = 1;
    uint constant MULTISIG_ADDED = 3;

    bytes32 public version = "1.0.0";

    modifier onlyMultiowned(address _initiator) {
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

    modifier only2FADisabled {
        require(!use2FA);
        _;
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
        require(_allowDelegateCall());
        _;
    }

    function init(address _oracle, bool _enable2FA)
    onlyCall
    onlyIssuer
    external
    returns (uint)
    {
        _init(contractOwner, _oracle);
        this.set2FA(_enable2FA);
        return OK;
    }

    function set2FA(bool _enabled)
    onlyCall
    onlyMultiowned(contractOwner)
    external
    returns (uint) 
    {
        require(getOracle() != 0x0);

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
        _setOracle(_oracle);
        return OK;
    }

    function updateBackendProvider(address _newBackendProvider)
    onlyCall
    onlyIssuer
    external
    returns (uint) 
    {
        require(_newBackendProvider != 0x0);

        backendProvider = UserBackendProviderInterface(_newBackendProvider);
        return OK;
    }

    function setRecoveryContract(address _recoveryContract) 
    onlyCall
    onlyMultiowned(contractOwner)
    public 
    returns (uint) 
    {
        require(_recoveryContract != 0x0);

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
        require(newAddress != 0x0);

        address _oldContractOwner = contractOwner;
        contractOwner = newAddress;
        _userOwnershipChanged(_oldContractOwner);

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
    only2FADisabled
    public 
    returns (bool _result) 
    {
        if (!_allowDelegateCall()) {
            return super.transferOwnership(_newOwner);
        } 

        address _oldContractOwner = contractOwner;
        _result = super.transferOwnership(_newOwner);
        if (_result) {
            _userOwnershipChanged(_oldContractOwner);
        }

        return _result;
    }

    function changeContractOwnership(address _to)
    only2FADisabled
    public
    returns (bool)
    {
        return super.changeContractOwnership(_to);
    }

    function claimContractOwnership()
    only2FADisabled
    public
    returns (bool _result)
    {
        if (!_allowDelegateCall()) {
            return super.claimContractOwnership();
        }

        address _oldContractOwner = contractOwner;
        _result = super.claimContractOwnership();
        if (_result) {
            _userOwnershipChanged(_oldContractOwner);
        }

        return _result;
    }

    function _allowDelegateCall() private view returns (bool) {
        // make sure this is used by delegatecall
        if (address(backendProvider) == 0x0) {
            return false;
        }

        address _backend = backendProvider.getUserBackend();
        return address(this) != _backend && _backend != 0x0; 
    }

    function _getUserRegistry() private view returns (UserRegistry) {
        return UserRegistry(backendProvider.getUserRegistry());
    }

    function _userOwnershipChanged(address _oldContractOwner) private {
        this.replaceOwner(_oldContractOwner, contractOwner);

        UserRegistry _userRegistry = _getUserRegistry();
        if (address(_userRegistry) != 0x0) {
            _userRegistry.userOwnershipChanged(this, _oldContractOwner);
        }
    }
}