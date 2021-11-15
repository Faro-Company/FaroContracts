//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../utils.sol";


contract EnglishAuction {

    Utils utils = new Utils();

    // static
    address public owner;
    uint256 public bidIncrement;
    uint256 public startTime;
    uint256 public endTime;
    uint256 auctionPeriodInSeconds;
    
    /// @notice the ERC721 token address of the vault's token
    ERC721 public token;
    uint256 public tokenId;

    // state
    bool public cancelled;
    
    uint256 public highestBindingBid;
    address public highestBidder;
    mapping(address => uint256) public bids;

    bool ownerHasWithdrawn;
    AuctionState public auctionState;

    event Bid(address bidder, uint256 bid, address highestBidder, uint256 highestBid, uint256 highestBindingBid);
    event Withdrawal(address withdrawer, address withdrawalAccount, uint amount);
    event Cancelled();

    enum AuctionState {
        AuctionDeployed,
        AuctionStarted,
        AuctionEnded,
        AuctionCancelled
    }

    modifier onlyOwner {
        if (msg.sender != owner) revert("Only owner can perform this operation.");
        _;
    }

    modifier onlyNotOwner {
        if (msg.sender == owner) revert("Owner cannot perform this operation.");
        _;
    }

    modifier onlyAfterStart {
        if (auctionState != AuctionState.AuctionStarted) revert("Auction state not live.");
        _;
    }

    modifier onlyBeforeEnd {
        if(block.timestamp > endTime) auctionState = AuctionState.AuctionEnded;
        if (auctionState == AuctionState.AuctionEnded) revert("Auction has already ended.");
        _;
    }

    modifier onlyNotCancelled {
        if (cancelled) revert("Auction was cancelled");
        _;
    }

    modifier onlyEndedOrCancelled {
        if (auctionState != AuctionState.AuctionEnded && !cancelled) revert("Auction must be ended or cancelled for this operation.");
        _;
    }

    constructor(address _owner, uint _bidIncrement, uint256 _auctionPeriodInSeconds,
        address _token, uint256 _tokenId) {
        require(IERC721(_token).ownerOf(_tokenId) == _owner, "Auction can only be deployed by the owner of the token");
        owner = _owner;
        bidIncrement = _bidIncrement;
        auctionPeriodInSeconds = _auctionPeriodInSeconds;
        token = ERC721(_token);
        tokenId = _tokenId;
        _escrow(owner, tokenId);
        auctionState = AuctionState.AuctionDeployed;
    }

    function _escrow(address _owner, uint256 _tokenId) internal {
        // it will throw if transfer fails
        token.transferFrom(_owner, address(this), _tokenId);
    }

    function getHighestBid() public view returns (uint) {
        return bids[highestBidder];
    }

    function startAuction() public onlyOwner {
        auctionState = AuctionState.AuctionStarted;
        startTime = block.timestamp;
        endTime = startTime + auctionPeriodInSeconds * 1 seconds;
    }

    function bid() public payable onlyAfterStart onlyBeforeEnd onlyNotCancelled onlyNotOwner returns (bool success) {
        // reject payments of 0 ETH
       require(msg.value > 0, "Cannot send bid with 0 value.");

        // calculate the user's total bid based on the current amount they've sent to the contract
        // plus whatever has been sent with this transaction
        uint256 newBid = bids[msg.sender] + msg.value;

        // if the user isn't even willing to overbid the highest binding bid, there's nothing for us
        // to do except revert the transaction.
        require(newBid > highestBindingBid, "Bid amount is less than highest");

        // grab the previous highest bid (before updating bids, in case msg.sender is the
        // highestBidder and is just increasing their maximum bid).
        uint256 highestBid = bids[highestBidder];
        bids[msg.sender] = newBid;

        if (newBid <= highestBid) {
            // if the user has overbid the highestBindingBid but not the highestBid, we simply
            // increase the highestBindingBid and leave highestBidder alone.

            // note that this case is impossible if msg.sender == highestBidder because you can never
            // bid less ETH than you've already bid.

            highestBindingBid = min(newBid + bidIncrement, highestBid);
        } else {
            // if msg.sender is already the highest bidder, they must simply be wanting to raise
            // their maximum bid, in which case we shouldn't increase the highestBindingBid.

            // if the user is NOT highestBidder, and has overbid highestBid completely, we set them
            // as the new highestBidder and recalculate highestBindingBid.

            if (msg.sender != highestBidder) {
                highestBidder = msg.sender;
                highestBindingBid = min(newBid, highestBid + bidIncrement);
            }
            highestBid = newBid;
        }

        emit Bid(msg.sender, newBid, highestBidder, highestBid, highestBindingBid);
        return true;
    }

    function min(uint256 a, uint256 b) private pure returns (uint256) {
        if (a < b) return a;
        return b;
    }

    function cancelAuction() public onlyOwner onlyBeforeEnd onlyNotCancelled returns (bool success) {
        cancelled = true;
        auctionState = AuctionState.AuctionCancelled;
        emit Cancelled();
        return true;
    }

    function withdrawNFT() public onlyEndedOrCancelled {
        if (msg.sender == highestBidder)
            token.transferFrom(address(this), msg.sender, tokenId);
    }
    function withdraw() public onlyEndedOrCancelled returns (bool success)
    {
        address withdrawalAccount;
        uint withdrawalAmount;

        if (cancelled) {
            // if the auction was cancelled, everyone should simply be allowed to withdraw their funds
            withdrawalAccount = msg.sender;
            withdrawalAmount = bids[withdrawalAccount];

        } else {
            // the auction finished without being cancelled

            if (msg.sender == owner) {
                // the auction's owner should be allowed to withdraw the highestBindingBid
                withdrawalAccount = highestBidder;
                withdrawalAmount = highestBindingBid;
                ownerHasWithdrawn = true;

            } else if (msg.sender == highestBidder) {
                // the highest bidder should only be allowed to withdraw the difference between their
                // highest bid and the highestBindingBid
                withdrawalAccount = highestBidder;
                withdrawalAmount = bids[highestBidder] - highestBindingBid;
            } else {
                // anyone who participated but did not win the auction should be allowed to withdraw
                // the full amount of their funds
                withdrawalAccount = msg.sender;
                withdrawalAmount = bids[withdrawalAccount];
            }
        }
        if (withdrawalAmount == 0) revert("Withdrawal amount cannot be 0");
        bids[withdrawalAccount] -= withdrawalAmount;
        // send the funds
        require(utils.sendStableCoin(address(this), withdrawalAccount,
            withdrawalAmount), "Transfer amount not successful");
        emit Withdrawal(msg.sender, withdrawalAccount, withdrawalAmount);
        return true;
    }
}


