//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


import "../Funding/FaroOffering.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract FaroDutchAuction {

    uint32 constant DAYS_IN_SECS = 86400;
    uint32 constant MAX_TIME_TICKS_ALLOWED = 1440;

    FaroOffering public offerableOwnership;
    FaroFractional public immutable fractional;
    mapping (address => bool) public eligibleBidders;

    uint32 public remaining;
    uint32 supply;
    address public owner;

    uint256 public auctionStopPrice;
    uint256 public auctionCurrentPrice;
    uint256[] priceUpdateArray;
    uint16 tickSize;
    uint16 public timeTick;

    address payable public projectFundingAddress;

    uint256 public startTime;
    uint256 public endTime;

    mapping (address => uint) private bids;

    enum AuctionState {
        AuctionDeployed,
        AuctionStarted,
        AuctionEnded
    }

    AuctionState public auctionState;

    /// @notice An event emitted when bid happens
    event Bid(address indexed bidder, uint amount);

    modifier isOwner() {
        require(msg.sender == owner, "This method can only be called by owner");
        _;
    }

    modifier isNotOwner() {
        require(msg.sender != owner, "Owner is not allowed to bid");
        _;
    }

    modifier onlyStarted() {
        require(auctionState == AuctionState.AuctionStarted, "Auction is not live.");
        _;
    }

    modifier updateAuctionState() {
        if (block.timestamp > endTime || timeTick == tickSize) {
            _end();
        }
        _;
    }

    modifier updatePrice() {
        timeTick = uint16((block.timestamp - startTime) / DAYS_IN_SECS);
        if (timeTick > tickSize) {
            timeTick = tickSize;
        }
        auctionCurrentPrice = priceUpdateArray[timeTick];
        _;
    }

    function getFractionalBalance(address funder) public view returns(uint256) {
        return fractional.balanceOf(funder);
    }

    function setCurrentPrice() public updatePrice updateAuctionState returns(uint256) {
        return auctionCurrentPrice;
    }

    constructor(address _offeringAddress, address _owner, uint[] memory _priceUpdateArray, uint32 _supply,
        address[] memory _eligibleBidders) {
        require(_priceUpdateArray.length <= MAX_TIME_TICKS_ALLOWED, "Too large price update array");
        offerableOwnership = FaroOffering(_offeringAddress);
        require(_owner == offerableOwnership.owner(), "Auction can only be created by offering owner");
        for (uint i = 0; i < _eligibleBidders.length; i++) {
            if (_eligibleBidders[i] == _owner) {
                revert("Owner cannot be among eligible bidders");
            }
        }
        priceUpdateArray = _priceUpdateArray;
        tickSize = uint16(priceUpdateArray.length - 1);
        owner = _owner;
        fractional = FaroFractional(offerableOwnership.getFractionalAddress());
        auctionStopPrice = offerableOwnership.listingPrice();
        projectFundingAddress = offerableOwnership.projectFundingAddress();
        auctionCurrentPrice = priceUpdateArray[0];
        auctionState = AuctionState.AuctionDeployed;
        supply = _supply;
        remaining = supply;
        createEligibleBiddersTable(_eligibleBidders);
    }

    function createEligibleBiddersTable(address[] memory _eligibleBidders) internal {
        for (uint i = 0; i < _eligibleBidders.length; i++) {
            eligibleBidders[_eligibleBidders[i]] = true;
        }
    }

    function start() public isOwner {
        require(auctionState == AuctionState.AuctionDeployed, "Auction is already started.");
        require(offerableOwnership.getFractionalBalance(address(this)) == supply,
            "Fractional tokens are not minted to Dutch auction account.");
        startTime = block.timestamp;
        endTime = startTime + priceUpdateArray.length * 1 days;
        auctionState = AuctionState.AuctionStarted;
    }

    function bid(uint32 _amount) public payable isNotOwner onlyStarted updatePrice updateAuctionState {
        uint totalToPay = _amount * auctionCurrentPrice;
        require(eligibleBidders[msg.sender], "Bidder is not eligible.");
        require(msg.value >= totalToPay, "Bid value is less than current price.");
        require(_amount <= remaining, "Bid amount is higher than remaining amount.");
        remaining -= _amount;
        require(payable(projectFundingAddress).send(totalToPay),
            "Could not send the funds to the project offerings address.");
        fractional.transfer(msg.sender, _amount);
        emit Bid(msg.sender, _amount);
        if (remaining == 0) {
            _end();
        }
    }

    function end() public isOwner {
        _end();
    }

    function _end() private {
        auctionState = AuctionState.AuctionEnded;
    }
}
