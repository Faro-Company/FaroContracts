
//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Interfaces/ISettings.sol";

abstract contract ListingSettings is Ownable, ISettings {

    /// @notice a mapping of users to their funding amounts
    mapping(address => uint256) public funders;

}