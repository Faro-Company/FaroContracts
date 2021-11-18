//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract USDCMock is ERC20 {
    constructor() ERC20("USD mock", "USDC") {
        _mint(msg.sender, 3166118718862955  * 10**2);
    }
}