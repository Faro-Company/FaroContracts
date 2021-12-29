//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract Utils {

    IERC20 public constant USDC = IERC20(0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e);

    function sendStableCoin(address from, address to, uint256 value) external returns (bool){
        if (!_attemptUSDCTransfer(from, to, value)) {
            return false;
        }
        return true;
    }

    function _attemptUSDCTransfer(address from, address to, uint256 value) internal returns (bool)
    {
        return USDC.transferFrom(from, to, value);
    }

    function getUSDBalance(address source) public view returns(uint256) {
        return USDC.balanceOf(source);
    }
}
