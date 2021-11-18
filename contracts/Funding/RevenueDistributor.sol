//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../utils.sol";
import "./OfferableERC721TokenVault.sol";



contract RevenueDistributor {

    Utils utils = new Utils();
    OfferableERC721TokenVault public immutable offerableOwnership;
    mapping(address => uint) private funders;
    mapping(address => uint256) dividendsWithdrawn;
    address payable escrow;

    constructor(address vaultAddress) {
        offerableOwnership = OfferableERC721TokenVault(vaultAddress);
    }

    function sendRevenue() public {
        require(utils.sendStableCoin(msg.sender, escrow, msg.value), "Could not send the revenue to escrow");
    }

    // TODO: Complete dividend logic.
    function withdrawRevenue() public {
        uint256 totalFunding = offerableOwnership.getTotalBoughtAmount();
        address funder = msg.sender;
        require (funders[funder] > 0, "Withdraw attempt rejected, sender not in funders.");
        uint256 dividendForFunder;
        uint256 revenue = utils.getUSDBalance(escrow);
        dividendForFunder = revenue * funders[funder];
        dividendForFunder /= totalFunding;
        require(utils.sendStableCoin(address(this), payable(funder), dividendForFunder - dividendsWithdrawn[funder]),
            "Could not send the corresponding dividend to funder");
        dividendsWithdrawn[funder] = dividendForFunder;
    }
}
