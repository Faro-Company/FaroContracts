//SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FaroToken is ERC20 {

    constructor() ERC20("Faro Studio Token", "FARO") {
        _mint(msg.sender, 244000000 * 10**uint(decimals()));
    }
}
