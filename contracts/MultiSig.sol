pragma solidity ^0.4.21;


/// @title Multisignature wallet - Allows multiple parties to agree on transactions before execution.
/// @author Stefan George - <stefan.george@consensys.net>
contract MultiSig {

    uint constant public MAX_OWNER_COUNT = 50;

    bytes constant SIGNATURE_PREFIX = "\x19Ethereum Signed Message:\n32";

    event Confirmation(address indexed sender, uint indexed transactionId);
    event Revocation(address indexed sender, uint indexed transactionId);
    event Submission(uint indexed transactionId);
    event Execution(uint indexed transactionId);
    event ExecutionFailure(uint indexed transactionId);
    event Cancelled(uint indexed transactionId);
    event Deposit(address indexed sender, uint value);
    event OwnerAddition(address indexed owner);
    event OwnerRemoval(address indexed owner);
    event RequirementChange(uint required);

    uint8 constant STATUS_NOT_INITIALIZED = 0;
    uint8 constant STATUS_PENDING = 1 << 0;
    uint8 constant STATUS_READY = 1 << 1;
    uint8 constant STATUS_EXECUTED = 1 << 2;
    uint8 constant STATUS_CANCELLED = 1 << 3;

    mapping (uint => Transaction) public transactions;
    mapping (uint => mapping (address => bool)) public confirmations;
    mapping (address => bool) public isOwner;
    address[] internal owners;
    uint public required;
    uint public transactionCount;

    struct Transaction {
        address destination;
        uint value;
        bytes data;
        uint8 status;
    }

    modifier onlySelf() {
        if (msg.sender != address(this)) {
            revert("[MultiSig]: Only 'this' allowed to call");
        }
        _;
    }

    modifier ownerDoesNotExist(address owner) {
        if (isOwner[owner]) {
            revert("[MultiSig]: Owner should not exist");
        }
        _;
    }

    modifier ownerExists(address owner) {
        if (!isOwner[owner]) {
            revert("[MultiSig]: owner should not exist");
        }
        _;
    }

    modifier transactionExists(uint transactionId) {
        if (transactions[transactionId].status == STATUS_NOT_INITIALIZED) {
            revert("[MultiSig]: tx should exist");
        }
        _;
    }

    modifier confirmed(uint transactionId, address owner) {
        if (!confirmations[transactionId][owner]) {
            revert("[MultiSig]: tx should be confirmed");
        }
        _;
    }

    modifier notConfirmed(uint transactionId, address owner) {
        if (confirmations[transactionId][owner]) {
            revert("[MultiSig]: tx should not be confirmed");
        }
        _;
    }

    modifier notExecuted(uint transactionId) {
        uint8 _status = transactions[transactionId].status;
        if ((_status & (STATUS_EXECUTED | STATUS_CANCELLED)) != 0) {
            revert("[MultiSig]: tx should not be executed");
        }
        _;
    }

    modifier notNull(address _address) {
        if (_address == 0x0) {
            revert("[MultiSig]: address should not be 0x0");
        }
        _;
    }

    modifier validRequirement(uint ownerCount, uint _required) {
        if (ownerCount > MAX_OWNER_COUNT
            || _required > ownerCount
            || _required == 0
            || ownerCount == 0
        ) {
            revert("[MultiSig]: valid multisig requirement is not met");
        }
        _;
    }

    /// @dev Fallback function allows to deposit ether.
    function()
    payable
    external
    {
        if (msg.value > 0) {
            emit Deposit(msg.sender, msg.value);
        }
    }

    /*
     * Public functions
     */
    /// @dev Contract constructor sets initial owners and required number of confirmations.
    constructor() public {

    }

    /// @param _owners List of initial owners.
    /// @param _required Number of required confirmations.
    function _initMultiSig(address[] _owners, uint _required)
    validRequirement(_owners.length, _required)
    internal
    {
        require(required == 0, "[MultiSig]: 'required' should not be initialized");
        owners.length = 0;

        for (uint i = 0; i < _owners.length; ++i) {
            if (isOwner[_owners[i]] || _owners[i] == 0) {
                revert("[MultiSig]: owner should not be skipped");
            }
            isOwner[_owners[i]] = true;
        }
        owners = _owners;
        required = _required;
    }

    /// @dev Allows to add a new owner. Transaction has to be sent by wallet.
    /// @param owner Address of new owner.
    function addOwner(address owner)
    onlySelf
    ownerDoesNotExist(owner)
    notNull(owner)
    validRequirement(owners.length + 1, required)
    public
    {
        isOwner[owner] = true;
        owners.push(owner);
        emit OwnerAddition(owner);
    }

    /// @dev Allows to remove an owner. Transaction has to be sent by wallet.
    /// @param owner Address of owner.
    function removeOwner(address owner)
    onlySelf
    ownerExists(owner)
    public
    {
        isOwner[owner] = false;
        for (uint i = 0; i < owners.length - 1; ++i) {
            if (owners[i] == owner) {
                owners[i] = owners[owners.length - 1];
                break;
            }
        }

        owners.length -= 1;
        if (required > owners.length) {
            changeRequirement(owners.length);
        }
        emit OwnerRemoval(owner);
    }

    /// @dev Allows to replace an owner with a new owner. Transaction has to be sent by wallet.
    /// @param owner Address of owner to be replaced.
    /// @param owner Address of new owner.
    function replaceOwner(address owner, address newOwner)
    onlySelf
    ownerExists(owner)
    ownerDoesNotExist(newOwner)
    public
    {
        for (uint i = 0; i < owners.length; ++i) {
            if (owners[i] == owner) {
                owners[i] = newOwner;
                break;
            }
        }
        isOwner[owner] = false;
        isOwner[newOwner] = true;

        emit OwnerRemoval(owner);
        emit OwnerAddition(newOwner);
    }

    /// @dev Allows to change the number of required confirmations. Transaction has to be sent by wallet.
    /// @param _required Number of required confirmations.
    function changeRequirement(uint _required)
    onlySelf
    validRequirement(owners.length, _required)
    public
    {
        required = _required;
        emit RequirementChange(_required);
    }

    /// @dev Allows an owner to submit and confirm a transaction.
    /// @param destination Transaction target address.
    /// @param value Transaction ether value.
    /// @param data Transaction data payload.
    /// @return Returns transaction ID.
    function submitTransaction(address destination, uint value, bytes data)
    public
    returns (uint transactionId)
    {
        transactionId = addTransaction(destination, value, data);
        confirmTransaction(transactionId);
    }

    /// @dev Allows an owner to confirm a transaction.
    /// @param transactionId Transaction ID.
    function confirmTransaction(uint transactionId)
    ownerExists(msg.sender)
    transactionExists(transactionId)
    notConfirmed(transactionId, msg.sender)
    public
    {
        confirmations[transactionId][msg.sender] = true;
        emit Confirmation(msg.sender, transactionId);
        executeTransaction(transactionId);
    }

    /// @notice Confirms a transaction for any owner with signed message.
    /// Message composition: keccak256(pass, transactionId, multisig contract address)
    /// @param transactionId transaction identifier to confirm
    /// @param pass temporary given random generated bytes
    /// @param v part of the signature
    /// @param r part of the signature
    /// @param s part of the signature
    function confirmTransactionWithVRS(uint transactionId, bytes pass, uint8 v, bytes32 r, bytes32 s)
    transactionExists(transactionId)
    public
    {
        bytes32 _message = getMessageForTransaction(transactionId, pass);
        address _owner = getSigner(_message, v, r, s);
        require(isOwner[_owner], "Owner does not exist");
        require(confirmations[transactionId][_owner], "Transaction is already confirmed by this owner");

        emit Confirmation(_owner, transactionId);
        executeTransaction(transactionId);
    }

    /// @dev Allows an owner to revoke a confirmation for a transaction.
    /// @param transactionId Transaction ID.
    function revokeConfirmation(uint transactionId)
    ownerExists(msg.sender)
    confirmed(transactionId, msg.sender)
    notExecuted(transactionId)
    public
    {
        delete confirmations[transactionId][msg.sender];
        emit Revocation(msg.sender, transactionId);
        uint _count = getConfirmationCount(transactionId);
        if (_count == 0) {
            Transaction storage _tx = transactions[transactionId];
            _tx.status = STATUS_CANCELLED;
            emit Cancelled(transactionId);
        }
    }

    /// @dev Allows anyone to execute a confirmed transaction.
    /// @param transactionId Transaction ID.
    function executeTransaction(uint transactionId)
    notExecuted(transactionId)
    public
    {
        if (isConfirmed(transactionId)) {
            Transaction storage _tx = transactions[transactionId];
            _tx.status = STATUS_EXECUTED;
            // solium-disable security/no-call-value
            if (_tx.destination.call.value(_tx.value)(_tx.data)) {
                emit Execution(transactionId);
            }
            else {
                emit ExecutionFailure(transactionId);
                _tx.status = STATUS_READY;
            }
        }
    }

    /// @dev Returns the confirmation status of a transaction.
    /// @param transactionId Transaction ID.
    /// @return Confirmation status.
    function isConfirmed(uint transactionId)
    public
    view
    returns (bool)
    {
        uint count = getConfirmationCount(transactionId);
        if (count == required) {
            return true;
        }
    }

    /*
     * Internal functions
     */
    /// @dev Adds a new transaction to the transaction mapping, if transaction does not exist yet.
    /// @param destination Transaction target address.
    /// @param value Transaction ether value.
    /// @param data Transaction data payload.
    /// @return Returns transaction ID.
    function addTransaction(address destination, uint value, bytes data)
    notNull(destination)
    internal
    returns (uint transactionId)
    {
        transactionId = transactionCount;
        transactions[transactionId] = Transaction({
            destination: destination,
            value: value,
            data: data,
            status: STATUS_PENDING
        });
        transactionCount += 1;
        emit Submission(transactionId);
    }

    /*
     * Web3 call functions
     */
    /// @dev Returns number of confirmations of a transaction.
    /// @param transactionId Transaction ID.
    /// @return Number of confirmations.
    function getConfirmationCount(uint transactionId)
    public
    view
    returns (uint count)
    {
        for (uint i = 0; i < owners.length; ++i) {
            if (confirmations[transactionId][owners[i]]) {
                count += 1;
            }
        }
    }

    /// @dev Returns total number of transactions after filers are applied.
    /// @param statusMask mask of statuses that should be included in a fetch
    /// @return Total number of transactions after filters are applied.
    function getTransactionCount(uint8 statusMask)
    public
    view
    returns (uint count)
    {
        for (uint i = 0; i < transactionCount; ++i) {
            if ((transactions[i].status & statusMask) != 0) {
                count += 1;
            }
        }
    }

    /// @dev Returns list of owners.
    /// @return List of owner addresses.
    function getOwners()
    public
    view
    returns (address[])
    {
        return owners;
    }

    /// @dev Returns array with owner addresses, which confirmed transaction.
    /// @param transactionId Transaction ID.
    /// @return Returns array of owner addresses.
    function getConfirmations(uint transactionId)
    public
    view
    returns (address[] _confirmations)
    {
        address[] memory confirmationsTemp = new address[](owners.length);
        uint count = 0;
        uint i;
        for (i = 0; i < owners.length; ++i) {
            if (confirmations[transactionId][owners[i]]) {
                confirmationsTemp[count] = owners[i];
                count += 1;
            }
        }

        _confirmations = new address[](count);
        for (i = 0; i < count; ++i) {
            _confirmations[i] = confirmationsTemp[i];
        }
    }

    /// @dev Returns list of transaction IDs in defined range.
    /// @param from Index start position of transaction array.
    /// @param to Index end position of transaction array.
    /// @param statusMask mask of statuses that should be included in a fetch
    /// @return Returns array of transaction IDs.
    function getTransactionIds(uint from, uint to, uint8 statusMask)
    public
    view
    returns (uint[] _transactionIds)
    {
        uint[] memory transactionIdsTemp = new uint[](transactionCount);
        uint count = 0;
        uint i;
        for (i = 0; i < transactionCount; ++i) {
            if ((transactions[i].status & statusMask) != 0) {
                transactionIdsTemp[count] = i;
                count += 1;
            }
        }

        _transactionIds = new uint[](to - from);
        for (i = from; i < to; ++i) {
            _transactionIds[i - from] = transactionIdsTemp[i];
        }
    }

    function getSigner(bytes32 _message, uint8 v, bytes32 r, bytes32 s)
    public
    pure 
    returns (address)
    {
        return ecrecover(
            keccak256(abi.encodePacked(SIGNATURE_PREFIX, _message)),
            v, 
            r, 
            s
        );
    }

    function getMessageForTransaction(uint transactionId, bytes pass)
    public
    view
    returns (bytes32)
    {
        return keccak256(abi.encodePacked(pass, transactionId, address(this)));
    }
}