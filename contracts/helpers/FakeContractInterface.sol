/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.18;


contract FakeContractInterface {

    function createBoard(
        uint /* _tags */,
        uint /* _tagsArea */,
        uint /* _tagsCategory */,
        bytes32 /* _ipfsHash */
    )
    public 
    returns (uint) 
    {
    }

    function postJobInBoard(
        uint /* _flowType */,
        uint /* _area */,
        uint /* _category */,
        uint /* _skills */,
        uint /* _defaultPay */,
        bytes32 /* _detailsIPFSHash */,
        uint /* _boardId */
    )
    public
    returns (uint)
    {
    }

    function postJobOffer(
        uint /* _jobId */,
        uint /* _rate */,
        uint /* _estimate */,
        uint /* _ontop */
    )
    public
    returns (uint)
    {
    }

    function transferWithFee(
        address /* _from */,
        address /* _to */,
        uint /* _feeFromValue */,
        uint /* _additionalFee */
    )
    public
    payable
    returns (uint)
    {
    }

    function transferToMany(
        address /* _from */,
        address[] /* _to */,
        uint[] /* _value */,
        uint /* _feeFromValue */,
        uint /* _additionalFee */
    )
    public
    payable
    returns (uint)
    {
    }

    function rateWorkerSkills(
        uint /* _jobId */, 
        address /* _to */, 
        uint /* _area */, 
        uint /* _category */, 
        uint[] /* _skills */, 
        uint8[] /* _ratings */
    )
    public
    returns (uint) 
    {
    }

    function evaluateCategory(
        address /* _to */, 
        uint8 /* _rating */, 
        uint /* _area */, 
        uint /* _category */
    ) 
    external 
    returns (uint) 
    {
    }

    function evaluateMany(
        address /* _to */, 
        uint /* _areas */, 
        uint[] /* _categories */, 
        uint[] /* _skills */, 
        uint8[] /* _rating */
    )
    external 
    returns (uint) 
    {
    }

    function setMany(
        address /* _user */, 
        uint /* _areas */, 
        uint[] /* _categories */, 
        uint[] /* _skills */
    )
    public 
    returns (uint) 
    {
    }
}