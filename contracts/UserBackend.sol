/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.21;


import "solidity-shared-lib/contracts/Owned.sol";
import "./ThirdPartyMultiSig.sol";
import "./UserBase.sol";
import "./UserEmitter.sol";
import "./UserRegistry.sol";
import "./Cashback.sol";


/// @title Utilized as a library contract that receives delegated calls from frontend contracts
/// and provides two-factor authentication confirmation for its functions. 
/// See UserInterface contract for centralized information about frontend contract interface.
contract UserBackend is Owned, UserBase, ThirdPartyMultiSig, Cashback {

    event ReceivedEther(address sender, uint value);

    uint constant OK = 1;
    uint constant MULTISIG_ADDED = 3;

    /// @dev Cashback gas estimations about methods that cannot be measured from inside of the contract.
    /// @dev gas without one callcodecopy estimation taken by BaseByzantiumRouter
    uint constant ROUTER_DELEGATECALL_ESTIMATION = 1153;
    /// @dev gas taken before startCashbackEstimation() modifier
    uint constant CASHBACK_BEFORE_ESTIMATION = 483; 
    /// @dev gas taken by _transferCashback modifier
    uint constant CASHBACK_TRANSFER_ESTIMATION = 10421 + 250; // TODO: should add +250 more for getOracle() addition

    uint constant MULTISIG_CONFIRMATION_ESTIMATION = 32967; // without calculation of getConfirmationCount
    uint constant MULTISIG_GET_CONFIRMATION_COUNT_BASE_ESTIMATION = 1200; // without calculation of getConfirmationCount
    uint constant MULTISIG_CONFIRM_TRANSACTION_OVERRIDE_ESTIMATION = 3025; // especially _assertConfirmationConsistency estimation


    bytes32 public version = "1.1.0";

    /// @dev TODO:
    bool private useCashback = false;

    /// @dev Guards and organizes 2FA access when it's turned on.
    modifier onlyMultiowned(address _initiator) {
        if ((!use2FA && msg.sender == _initiator) ||
            msg.sender == address(this)
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

    modifier onlyMultiownedWithRemoteOwners {
        if ((!use2FA && _isOneOfOwners(msg.sender)) ||
            msg.sender == address(this)
        ) {
            _;
        }
        else if (use2FA && _isOneOfOwners(msg.sender)) {
            submitTransaction(address(this), msg.value, msg.data);
            assembly {
                mstore(0, 3) /// MULTISIG_ADDED
                return(0, 32)
            }
        }
    }

    modifier onlyVerifiedWithRemoteOwners(bytes32 _message, uint8 _v, bytes32 _r, bytes32 _s) {
        if ((!use2FA && _isOneOfOwners(msg.sender)) ||
            msg.sender == address(this)
        ) {
            _;
        }
        else if (use2FA &&
            _isOneOfOwners(msg.sender) &&
            getSigner(_message, _v, _r, _s) == getOracle()
        ) {
            _;
        }
    }

    /// @dev Guards functions against invocation when 2FA is enabled
    modifier only2FADisabled {
        require(!use2FA, "2FA should be disabled");
        _;
    }

    /// @dev Guards functions call only for recovery address
    modifier onlyRecoveryContract {
        if (recoveryContract == msg.sender) {
            _;
        }
    }

    /// @dev Guards functions call only for issuer address
    modifier onlyIssuer {
        if (issuer == msg.sender) {
            _;
        }
    }

    /// @dev Guards functions against invocation not from delegatecall
    modifier onlyCall {
        require(_allowDelegateCall(), "Only delegatecall is allowed");
        _;
    }

    modifier onlyContractContext {
        require(_isContractContext(), "USER_INVALID_INVOCATION_CONTEXT");
        _;
    }


    /// @notice Gets flag either cashback functionality turned on or off
    /// @return user registry contract address
    function isUsingCashback()
    public
    view
    returns (bool)
    {
        if (_isContractContext()) {
            return useCashback;
        }

        return UserBackend(backendProvider.getUserBackend()).isUsingCashback();
    }

    /// @notice Sets cashback functionality in active or inactive state only for UserBackend (as a library).
    /// Allowed only for authorized roles.
    /// @param _useCashback flag of cashback functionality; true if the functionality should be active, false otherwise
    /// @return result of an operation
    function setUseCashback(bool _useCashback)
    external
    onlyContractOwner
    onlyContractContext
    returns (uint)
    {
        useCashback = _useCashback;
        return OK;
    }

    /// @notice Initializes frontend contract with oracle and 2FA flag.
    /// Should be invoked by an issuer and before any other actions.
    /// Should be called only through delegatecall.
    /// @param _oracle oracle address for 2FA mode
    /// @param _enable2FA if true enables 2FA mode, false - keep it turned off
    /// @return result of an operation
    function init(address _oracle, bool _enable2FA)
    external
    onlyCall
    onlyIssuer
    returns (uint)
    {
        _init(contractOwner, _oracle);
        this.set2FA(_enable2FA);
        return OK;
    }

    /// @notice Changes status of 2FA mode.
    /// 2FA protected.
    /// Should only be invoked by contract owner.
    /// Should be called only through delegatecall.
    /// @param _enabled if true enables 2FA mode, false - turns it off
    /// @return result of an operation
    function set2FA(bool _enabled)
    external
    onlyCall
    onlyMultiowned(contractOwner)
    returns (uint) 
    {
        require(getOracle() != 0x0, "Oracle must be set before 2FA activation");

        if (use2FA != _enabled) {
            use2FA = _enabled;
            UserEmitter(this).emitUser2FAChanged(contractOwner, address(this), getUserProxy(), _enabled);
        }
        return OK;
    }

    /// @notice Updates user proxy contract
    /// 2FA protected.
    /// Should only be invoked by contract owner.
    /// Should be called only through delegatecall.
    /// @param _userProxy new user proxy contract address
    /// @return result of an operation
    function setUserProxy(UserProxy _userProxy) 
    public 
    onlyCall
    onlyMultiowned(contractOwner)
    returns (uint) 
    {
        userProxy = _userProxy;
        return OK;
    }

    /// @notice Gets associated user proxy address
    /// @return address of user proxy
    function getUserProxy() 
    public 
    view 
    returns (address) 
    {
        return userProxy;
    }

    /// @notice Updates address of an oracle
    /// 2FA protected.
    /// Should only be invoked by contract owner.
    /// Should be called only through delegatecall.
    /// @param _oracle new oracle address
    /// @return result of an operation
    function setOracle(address _oracle)
    external
    onlyCall
    onlyMultiowned(contractOwner)
    returns (uint)
    {
        _setOracle(_oracle);
        return OK;
    }

    function addThirdPartyOwner(address _owner)
    external
    onlyCall
    onlyMultiowned(contractOwner)
    returns (uint)
    {
        _addThirdPartyOwner(_owner);
        return OK;
    }

    function revokeThirdPartyOwner(address _owner)
    external
    onlyCall
    onlyMultiowned(contractOwner)
    returns (uint)
    {
        _revokeThirdPartyOwner(_owner);
        return OK;
    }

    /// @notice Updates address of backend provider
    /// Should be invoked by an issuer.
    /// Should be called only through delegatecall.
    /// @param _newBackendProvider address of a new backend provider contract
    /// @return result of an operation    
    function updateBackendProvider(address _newBackendProvider)
    external
    onlyCall
    onlyIssuer
    returns (uint) 
    {
        require(_newBackendProvider != 0x0, "Backend should not be 0x0");

        backendProvider = UserBackendProviderInterface(_newBackendProvider);
        return OK;
    }

    /// @notice Updates recovery address
    /// 2FA protected.
    /// Should only be invoked by contract owner.
    /// Should be called only through delegatecall.
    /// @param _recoveryContract new recovery address
    /// @return result of an operation
    function setRecoveryContract(address _recoveryContract) 
    public 
    onlyCall
    onlyMultiowned(contractOwner)
    returns (uint) 
    {
        require(_recoveryContract != 0x0, "Recovery contract address should not be 0x0");

        recoveryContract = _recoveryContract;
        return OK;
    }

    /// @notice Gets recovery address of a contract
    /// @return recovery address
    function getRecoveryContract()
    public
    view
    returns (address)
    {
        return recoveryContract;
    }

    /// @notice Performs user recovery (change of contract owner by any reason)
    /// Should only be invoked by recovery address.
    /// Should be called only through delegatecall.
    /// @param _newAddress new contract owner passed by recovery
    /// @return result of an operation
    function recoverUser(address _newAddress) 
    public
    onlyCall
    onlyRecoveryContract
    returns (uint) 
    {
        require(_newAddress != 0x0, "Recovered user should not be 0x0");

        address _oldContractOwner = contractOwner;
        contractOwner = _newAddress;
        _userOwnershipChanged(_oldContractOwner);

        return OK;
    }

    /// @notice Forwards invocations to a user proxy address
    /// 2FA protected.
    /// Should only be invoked by contract owner.
    /// Should be called only through delegatecall.
    /// @param _destination invocation target
    /// @param _data encoded data that will passed to _destination
    /// @param _value amount of Ether passed with call
    /// @param _throwOnFailedCall if true then revert on unsuccessful call, silently fail otherwise
    /// @return first 32 bytes of a call result
    function forward(
        address _destination,
        bytes _data,
        uint _value,
        bool _throwOnFailedCall
    )
    public
    returns (bytes32) 
    {
        return _forward(_destination, _data, _value, _throwOnFailedCall, [uint(0)]);
    }

    uint constant CALLDATA_PREFIX_FORWARD_LENGTH = 220;

    function _forward(
        address _destination,
        bytes _data,
        uint _value,
        bool _throwOnFailedCall,
        uint[1] memory _estimations
    )
    private
    startCashbackEstimation(_estimations)
    onlyCall
    onlyMultiownedWithRemoteOwners
    finishEstimationAndPayCashback(_estimations, CALLDATA_PREFIX_FORWARD_LENGTH, _getBeforeForwardGasEstimation())
    returns (bytes32) 
    {
        return userProxy.forward(_destination, _data, _value, _throwOnFailedCall);
    }

    function forwardWithVRS(
        address _destination,
        bytes _data,
        uint _value,
        bool _throwOnFailedCall,
        bytes _pass,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    )
    public
    onlyCall
    onlyVerifiedWithRemoteOwners(getMessageForForward(msg.sender, _destination, _data, _value, _pass), _v, _r, _s)
    returns (bytes32)
    {
        return userProxy.forward(_destination, _data, _value, _throwOnFailedCall);
    }

    /// @notice Transfers contract ownership to the other owner
    /// 2FA should be disabled.
    /// Could be called through delegatecall and also for UserBackend.
    /// Allowed only for a contract owner.
    /// @param _newOwner new owner of a contract
    /// @return true if owner change is successful, false otherwise
    function transferOwnership(address _newOwner) 
    public 
    only2FADisabled
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

    /// @notice Prepares ownership pass.
    /// 2FA should be disabled.
    /// Could be called through delegatecall and also for UserBackend.
    /// Allowed only for a contract owner.
    /// @param _to new owner of a contract
    /// @return true when successful, false otherwise
    function changeContractOwnership(address _to)
    public
    only2FADisabled
    returns (bool)
    {
        return super.changeContractOwnership(_to);
    }

    /// @notice Finalize ownership pass.
    /// 2FA should be disabled.
    /// Could be called through delegatecall and also for UserBackend.
    /// Allowed only for a contract owner.
    /// @return true when owner change is successful, false otherwise
    function claimContractOwnership()
    public
    only2FADisabled
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

    function getMessageForForward(
        address _sender,
        address _destination,
        bytes _data,
        uint _value,
        bytes _pass
    )
    public
    pure
    returns (bytes32)
    {
        return keccak256(abi.encodePacked(_pass, _sender, _destination, _data, _value));
    }

    /* CASHBACK */

    function _shouldPayCashback() internal view returns (bool) {
        // 'this' means executed during confirmation by an oracle
        return isUsingCashback() && msg.sender == address(this);
    }

    function _getBeforeForwardGasEstimation() private view returns (uint) {
        /*
        Have '2 * _estimateCalldatacopyGas()' because we have 1 indirect call (from user to router fallback) 
        and 1 direct (from router fallback to delegated backend)
        */
        return MULTISIG_CONFIRMATION_ESTIMATION + owners.length * MULTISIG_GET_CONFIRMATION_COUNT_BASE_ESTIMATION +
            (MULTISIG_CONFIRM_TRANSACTION_OVERRIDE_ESTIMATION + owners.length * MULTISIG_GET_CONFIRMATION_COUNT_BASE_ESTIMATION) +
            6 * ROUTER_DELEGATECALL_ESTIMATION + 
            CASHBACK_BEFORE_ESTIMATION + 
            2 * _estimateCalldatacopyGas();
    }

    /// @dev Highly depends on _transferCashback function implementation and all subsequent calls. Any changes in this
    ///     function should be depicted in updating _getTransferCashbackEstimation value.
    function _getTransferCashbackEstimation() internal pure returns (uint) {
        return CASHBACK_TRANSFER_ESTIMATION;
    }

    /// @notice Transfers caclulated cashback directly to a caller
    function _transferCashback(uint _cashbackValue) internal {
        userProxy.transferEther(getOracle(), _cashbackValue);
    }

    /* INTERNAL */

    function _isContractContext() private view returns (bool) {
        // backend provider will be always 0x0 in the context of UserBackend
        return address(backendProvider) == 0x0;
    }

    function _allowDelegateCall() private view returns (bool) {
        // make sure this is used by delegatecall
        if (_isContractContext()) {
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

    function _isOneOfOwners(address _address) private view returns (bool) {
        return _address == getOwner() || isThirdPartyOwner(_address);
    }
}