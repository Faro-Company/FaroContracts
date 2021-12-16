//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FaroToken is ERC20 {

    constructor() ERC20("Faro Studio Token", "FARO") {
        _mint(msg.sender, 2440000000 * 10**uint(decimals()));
    }
}
