//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FaroFractional is ERC20Upgradeable, Ownable {

    constructor(string memory _name, string memory _symbol, uint256 _supply, address _mintingAddress) {
        __ERC20_init(_name, _symbol);
        _mint(_mintingAddress, _supply);
    }

    function mint(uint _supply, address _mintingAddress) onlyOwner {
        _mint(_mintingAddress, _supply);
    }
}