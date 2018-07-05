/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.21;


import "solidity-roles-lib/contracts/Roles2LibraryAdapter.sol";
import "solidity-shared-lib/contracts/Owned.sol";
import "./UserRouter.sol";
import "./UserInterface.sol";


contract UserFactory is Roles2LibraryAdapter {

    uint constant USER_FACTORY_SCOPE = 21000;

    event UserCreated(
        address indexed self,
        address indexed user,
        address proxy,
        address recoveryContract,
        address owner
    );

    address public userBackendProvider;
    address public oracle;
    address public eventsHistory;

    constructor(address _roles2Library) Roles2LibraryAdapter(_roles2Library) public {
        eventsHistory = this;
    }

    function getEventsHistory() 
    public 
    view 
    returns (address) 
    {
        return eventsHistory;
    }

    function setupEventsHistory(address _eventsHistory) 
    auth 
    external 
    returns (uint) 
    {
        require(_eventsHistory != 0x0);

        eventsHistory = _eventsHistory;
        return OK;
    }

    function setUserBackendProvider(address _newUserBackendProvider)
    auth
    external
    returns (uint)
    {
        require(_newUserBackendProvider != 0x0);

        userBackendProvider = _newUserBackendProvider;
        return OK;
    }

    function setOracleAddress(address _oracle)
    auth
    external
    returns (uint)
    {
        require(_oracle != 0x0);

        oracle = _oracle;
        return OK;
    }

    function createUserWithProxyAndRecovery(
        address _owner,
        address _recoveryContract,
        bool _use2FA
    )
    public
    returns (uint) 
    {
        require(_owner != 0x0, "Owner should not be equal to 0x0");

        UserInterface user = UserInterface(new UserRouter(_owner, _recoveryContract, userBackendProvider));
        user.init(oracle, _use2FA);

        address proxy = user.getUserProxy();
        UserFactory(getEventsHistory()).emitUserCreated(
            user,
            proxy,
            _recoveryContract,
            _owner
        );
        return OK;
    }

    function updateBackendProviderForUser(UserInterface _user) 
    auth
    external
    returns (uint) 
    {
        return _user.updateBackendProvider(userBackendProvider);
    }

    function emitUserCreated(
        address _user,
        address _proxy,
        address _recoveryContract,
        address _owner
    ) 
    external 
    {
        emit UserCreated(
            msg.sender,
            _user,
            _proxy,
            _recoveryContract,
            _owner
        );
    }
}
