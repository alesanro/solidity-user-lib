/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;


/// @title TODO:
/// @dev Any contract that inherits from Cashback should implement _getTransferCashbackEstimation and
///		_transferCashback functions to fully cover all predefined gas estimations
contract Cashback {

    uint constant G_MEMORY = 3;
    uint constant G_COPY = 3;
    uint constant G_VERYLOW = 3;
    uint constant TX_INPUT_ZERO_BYTES_PRICE = 4;
    uint constant TX_INPUT_NONZERO_BYTES_PRICE = 68;
    uint constant TX_DEFAULT_PRICE = 21000;
    uint constant BYTES_WORD_SIZE = 32; // 256 bits

    uint constant ESTIMATION_CALCULATION_GAS = 51;

    modifier startCashbackEstimation(uint[1] memory _estimations) {
        _estimations[0] = gasleft();
        _;
    }
    
    modifier finishEstimationAndPayCashback(uint[1] memory _estimations, uint _beforeStartCashbackGasEstimation) {
        _;
        
        if (!_shouldPayCashback()) {
            return;
        }

        uint _constantGas = _getConstantGas();
        uint _gasAfterwards = gasleft();
        uint _totalGasSpent = _constantGas + _beforeStartCashbackGasEstimation + (_estimations[0] - _gasAfterwards);
        uint _debt = _totalGasSpent * tx.gasprice;
    
        _transferCashback(_debt);
    }

    function _estimateCalldatacopyGas() internal pure returns (uint _result) {
        uint _calldatasize;
        assembly {
            _calldatasize := calldatasize
        }
        
         // G_MEMORY used here as memory expansion coefficient; must be quadratic after 724B memory
        _result = G_VERYLOW + G_COPY * G_MEMORY * _calldatasize / BYTES_WORD_SIZE;
    }
    
    function _estimateTxInputDataGas() private pure returns (uint _result) {
        uint _calldatasize;
        assembly {
            _calldatasize := calldatasize
        }
        
        /*
        We put here a lot of investigations and experiments here for the result where
        total gas fee payed for passed transaction input data will be calculated
        as expensive as possible for non-zero bytes and takes 68 for each non-zero byte.
        That takes less gas than calculating number of zero and non-zero bytes by smart
        contract itself or using approximate ratio between zero and non-zero
        number of bytes.
        */
        _result = _calldatasize * TX_INPUT_NONZERO_BYTES_PRICE;
        // uint _nonZeroBytesNumber = (5 * _calldatasize / 10);
        // uint _zeroBytesNumber = _calldatasize - _nonZeroBytesNumber;
        // _result = _nonZeroBytesNumber * TX_INPUT_NONZERO_BYTES_PRICE + _zeroBytesNumber * TX_INPUT_ZERO_BYTES_PRICE;
    }
    
    function _getConstantGas() private pure returns (uint) {
        return TX_DEFAULT_PRICE + _estimateTxInputDataGas() + ESTIMATION_CALCULATION_GAS + _getTransferCashbackEstimation();
    }

    function _shouldPayCashback() internal view returns (bool);
    function _getTransferCashbackEstimation() internal pure returns (uint);
    function _transferCashback(uint _cashbackValue) internal;
}
