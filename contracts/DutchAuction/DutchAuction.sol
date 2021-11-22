//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../utils.sol";
import "../Funding/OfferableERC721TokenVault.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract DutchAuction {

    Utils utils = new Utils();

    /// @notice usdc address
    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    /// @notice An event emitted when bid happens
    event Bid(address indexed bidder, uint amount);
    uint constant HOURS_IN_MILLISECS = 3600000;
    uint constant MAX_TIME_TICKS_ALLOWED = 1440;

    uint maxTokensSold;
    uint remaining;

    uint256 auctionStopPrice;
    uint256 auctionCurrentPrice;
    uint256[] priceUpdateArray;

    address payable public wallet;

    uint256 public startTime;
    uint256 public endTime;

    mapping (address => uint) private bids;

    AuctionState public auctionState;
    address private fractional;

    enum AuctionState {
        AuctionDeployed,
        AuctionStarted,
        AuctionEnded
    }

    modifier atState(AuctionState _auctionState) {
        if (auctionState != _auctionState)
            revert("Auction is in unexpected state.");
        _;
    }

    modifier isOwner() {
        if (msg.sender != wallet)
            revert("Sender is not the project owner");
        _;
    }

    modifier isNotOwner() {
        if (msg.sender == wallet)
            revert("Owner is not allowed to bid");
        _;
    }


    modifier updateAuctionState() {
        if (auctionState == AuctionState.AuctionStarted && (block.timestamp > endTime || calculatePrice() <= auctionStopPrice))
            finalizeAuction();
        _;
    }

    constructor(uint256 _stopPrice, uint256 _maxTokensSold, address projectFundingAddress, address _fractional,
        uint[] memory _priceUpdateArray) {
        require(_priceUpdateArray.length <= MAX_TIME_TICKS_ALLOWED, "Too large price update array");
        priceUpdateArray = _priceUpdateArray;
        auctionCurrentPrice = priceUpdateArray[0];
        auctionStopPrice = _stopPrice;
        maxTokensSold = _maxTokensSold;
        auctionState = AuctionState.AuctionDeployed;
        remaining = maxTokensSold;
        wallet = projectFundingAddress;
        fractional = _fractional;
    }

    function startAuction() public isOwner atState(AuctionState.AuctionDeployed) {
        startTime = block.timestamp;
        endTime = startTime + priceUpdateArray.length * 1 hours;
        auctionState = AuctionState.AuctionStarted;
    }

    function calculatePrice() public returns (uint256) {
        uint256 timeTick = (block.timestamp - startTime) % HOURS_IN_MILLISECS;
        auctionCurrentPrice = priceUpdateArray[timeTick];
        return auctionCurrentPrice;
    }

    function sendStableCoin(address from, address to, uint256 value) internal returns (bool) {
        // Try to transfer USDC to the given recipient.
        if (!_attemptUSDCTransfer(from, to, value)) {
            return false;
        }
        return true;
    }

    // USDC transfer internal method
    function _attemptUSDCTransfer(address from, address to, uint256 value) internal returns (bool)
    {
        return USDC.transferFrom(from, to, value);
    }

    function bid(uint256 _amount, uint256 _value) public payable atState(
        AuctionState.AuctionStarted) isNotOwner updateAuctionState {
        require(_value >= auctionCurrentPrice, "Bid value is less than current price.");
        require(_amount <= remaining, "Bid amount is higher than remaining amount.");
        remaining -= _amount;
        bids[msg.sender] += _value;
        require(sendStableCoin(msg.sender, wallet, _value),
            "Could not send the funds to the project offerings address.");
        IERC20(fractional).transferFrom(address(this), msg.sender, _amount);
        emit Bid(msg.sender, _amount);
        if (remaining == 0) {
            finalizeAuction();
        }
    }

    function finalizeAuction() private {
        auctionState = AuctionState.AuctionEnded;
    }

    function withdraw() public atState(AuctionState.AuctionEnded) {
        require(bids[msg.sender] > 0, "Not among bidders.");
        require(sendStableCoin(wallet, msg.sender, bids[msg.sender] - auctionCurrentPrice),
            "Could not send change to the bidding participant.");
        bids[msg.sender] = 0;
    }
}
