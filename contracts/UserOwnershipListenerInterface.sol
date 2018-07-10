/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.21;


/// @title TODO:
interface UserOwnershipListenerInterface {
	function userOwnershipChanged(address _contract, address _from) external;
}