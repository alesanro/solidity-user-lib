/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.23;


/// @title Defines an interface for those who wants to trigger and log events related with
/// ownership changes. Supported by UserRegistry contract.
interface UserOwnershipListenerInterface {
	function userOwnershipChanged(address _contract, address _from) external;
}