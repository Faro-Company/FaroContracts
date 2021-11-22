//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract KTLOFractional is ERC20, Ownable{

    constructor(string memory _name, string memory _symbol, uint256 _supply,
        address _mintingAddress) {
        __ERC20_init(_name, _symbol);
        _mint(_mintingAddress, _supply);
    }

    function mint(uint256 _supply, address dest) onlyOwner {
        _mint(dest, _supply);
    }
}