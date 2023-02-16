//SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FaroEnglishAuction is Ownable, Pausable, IERC721Receiver {
  enum AuctionState {
    AuctionCreated,
    AuctionStarted,
    AuctionEnded,
    AuctionCancelled
  }

  enum Action {
    Create,
    Start,
    Cancel,
    Bid,
    Withdraw,
    WithdrawNFT,
    End
  }

  struct Token {
    address tokenAddr;
    uint256 tokenId;
  }

  struct Auction {
    uint256 auctionId;
    address tokenOwner;
    Token token;
    uint256 startTime;
    uint256 duration;
    uint256 floorPrice;
    uint256 bidIncrement;
    uint256 highestBid;
    address highestBidder;
    AuctionState auctionState;
  }

  uint256 private constant MAX_AUCTION_PERIOD = 365 days;
  uint256 private auctionCount;
  Auction[] private allAuctions;
  mapping(bytes32 => uint256[]) private tokenToAuctIndices;
  mapping(uint256 => mapping(address => uint256)) private auctIdToBids;
  Auction private dummyAuction; // for initial storage pointing

  // EVENTS
  // events kept minimal for gas saving,
  // for further details call getAuctionbyIndex after event
  event Created(uint256 indexed auctionId);
  event Started(uint256 indexed auctionId);
  event Cancelled(uint256 indexed auctionId);
  event Ended(uint256 indexed auctionId);
  event BidPlaced(uint256 indexed auctionId, uint256 highestBid);

  constructor() {}

  function createAuction(
    address tokenAddr,
    uint256 tokenId,
    uint256 auctDuration,
    uint256 floorPrice,
    uint256 bidIncrement
  ) external whenNotPaused {
    IERC721(tokenAddr).safeTransferFrom(msg.sender, address(this), tokenId);
    Token memory token = Token(tokenAddr, tokenId);
    Auction memory newAuctionData;
    newAuctionData.tokenOwner = msg.sender;
    newAuctionData.token = token;
    newAuctionData.duration = auctDuration;
    newAuctionData.floorPrice = floorPrice;
    newAuctionData.bidIncrement = bidIncrement;
    _executeAction(newAuctionData, Action.Create);
  }

  function startAuction(address tokenAddr, uint256 tokenId) external {
    Token memory token = Token(tokenAddr, tokenId);
    Auction memory data;
    data.token = token;
    _executeAction(data, Action.Start);
  }

  function cancelAuction(address tokenAddr, uint256 tokenId) external {
    Token memory token = Token(tokenAddr, tokenId);
    Auction memory data;
    data.token = token;
    _executeAction(data, Action.Cancel);
  }

  function endAuction(address tokenAddr, uint256 tokenId) external {
    Token memory token = Token(tokenAddr, tokenId);
    Auction memory data;
    data.token = token;
    _executeAction(data, Action.End);
  }

  function bid(address tokenAddr, uint256 tokenId) external payable {
    Token memory token = Token(tokenAddr, tokenId);
    Auction memory data;
    data.token = token;
    _executeAction(data, Action.Bid);
  }

  function withdraw(address tokenAddr, uint256 tokenId) external {
    Token memory token = Token(tokenAddr, tokenId);
    Auction memory data;
    data.token = token;
    _executeAction(data, Action.Withdraw);
  }

  function withdrawNFT(address tokenAddr, uint256 tokenId) external {
    Token memory token = Token(tokenAddr, tokenId);
    Auction memory data;
    data.token = token;
    _executeAction(data, Action.WithdrawNFT);
  }

  function pause() external onlyOwner {
    _pause();
  }

  function unpause() external onlyOwner {
    _unpause();
  }

  // View functions
  function getTotalAuctionCount() public view returns (uint256) {
    return auctionCount;
  }

  function getAuctionbyIndex(uint256 index) public view returns (Auction memory) {
    return allAuctions[index]; //reverts if out-of-bound
  }

  function getAuctionCountbyToken(address tokenAddr, uint256 tokenId) public view returns (uint256) {
    Token memory token = Token(tokenAddr, tokenId);
    (uint256 lenTokenAucts, , ) = _getTokenAuctData(token);
    return lenTokenAucts;
  }

  function getAuctionRemainingTimeByIndex(uint256 index) public view returns (uint256) {
    Auction memory auct = allAuctions[index];
    require(auct.auctionState == AuctionState.AuctionStarted, "Auction not started");
    uint256 remainingTime = auct.startTime + auct.duration - block.timestamp;
    return remainingTime;
  }

  function getIndexFromTokenAuctions(
    address tokenAddr,
    uint256 tokenId,
    uint256 index
  ) public view returns (uint256) {
    Token memory token = Token(tokenAddr, tokenId);
    (, , uint256[] storage tokenAuctIndices) = _getTokenAuctData(token);
    return tokenAuctIndices[index]; //reverts if out-of-bound
  }

  function getLastAuctionByToken(address tokenAddr, uint256 tokenId) public view returns (Auction memory) {
    Token memory token = Token(tokenAddr, tokenId);
    (, uint256 indexLastTokenAuct, ) = _getTokenAuctData(token);
    return allAuctions[indexLastTokenAuct];
  }

  function getBidOfAddressByAuctionId(uint256 auctionId, address bidder) public view returns (uint256) {
    return auctIdToBids[auctionId][bidder];
  }

  // Internal Functions

  function _executeAction(Auction memory _inputData, Action _action) internal {
    Token memory token = _inputData.token;
    (uint256 lenTokenAucts, uint256 indexLastTokenAuct, uint256[] storage tokenAuctIndices) = _getTokenAuctData(token);
    Auction storage lastTokenAuct = dummyAuction;
    AuctionState auctState;
    bool existsAuctionForToken = false;

    if (lenTokenAucts > 0) {
      lastTokenAuct = allAuctions[indexLastTokenAuct];
      auctState = lastTokenAuct.auctionState;
      existsAuctionForToken = true;

      // if auction is expired, update accordingly
      // check first auctState to save gas
      if (auctState == AuctionState.AuctionStarted) {
        uint256 endTime = lastTokenAuct.startTime + lastTokenAuct.duration;
        if (block.timestamp > endTime) {
          auctState = AuctionState.AuctionEnded;
          lastTokenAuct.auctionState = auctState;
          emit Ended(lastTokenAuct.auctionId);
        }
      }
    }

    if (_action == Action.Create) {
      require(_inputData.duration < MAX_AUCTION_PERIOD, "Auction duration too long");
      _inputData.auctionId = auctionCount;
      allAuctions.push(_inputData);
      tokenAuctIndices.push(_inputData.auctionId);
      auctionCount++;
      emit Created(_inputData.auctionId);
    } else {
      require(existsAuctionForToken, "No eligible auction exists for this action");
      bool withdrawEligible = (auctState == AuctionState.AuctionEnded || auctState == AuctionState.AuctionCancelled);
      if (_action == Action.Start) {
        _checkIfTokenOwner(lastTokenAuct, msg.sender);
        require(auctState == AuctionState.AuctionCreated, "Auction is not in created-state");
        lastTokenAuct.startTime = block.timestamp;
        lastTokenAuct.auctionState = AuctionState.AuctionStarted;
        emit Started(lastTokenAuct.auctionId);
      } else if (_action == Action.Cancel) {
        _checkIfTokenOwner(lastTokenAuct, msg.sender);
        require(auctState == AuctionState.AuctionStarted, "Auction is not live");
        lastTokenAuct.auctionState = AuctionState.AuctionCancelled;
        emit Cancelled(lastTokenAuct.auctionId);
      } else if (_action == Action.End) {
        // auction ending is already perfomed above
        require(auctState == AuctionState.AuctionEnded, "Auction cannot be ended");
      } else if (_action == Action.Bid) {
        _checkIfNotTokenOwner(lastTokenAuct, msg.sender);
        require(auctState == AuctionState.AuctionStarted, "Auction is not live");
        _bid(lastTokenAuct);
      } else if (_action == Action.Withdraw) {
        require(withdrawEligible, "Auction is still live or in created-state");
        _withdraw(lastTokenAuct);
      } else if (_action == Action.WithdrawNFT) {
        require(withdrawEligible, "Auction is still live or in created-state");
        _withdrawNFT(lastTokenAuct);
      }
    }
  }

  function _withdrawNFT(Auction storage _auction) internal {
    address recipient = address(0);
    address highestBidder = _auction.highestBidder;
    address tokenOwner = _auction.tokenOwner;
    AuctionState auctState = _auction.auctionState;
    if (
      (auctState == AuctionState.AuctionEnded && msg.sender == highestBidder) ||
      (auctState == AuctionState.AuctionEnded && highestBidder == address(0) && msg.sender == tokenOwner) ||
      (auctState == AuctionState.AuctionCancelled && msg.sender == tokenOwner)
    ) {
      recipient = msg.sender;
    }
    require(recipient != address(0), "cannot transfer NFT");
    IERC721(_auction.token.tokenAddr).safeTransferFrom(address(this), recipient, _auction.token.tokenId);
  }

  function _bid(Auction storage _auction) internal {
    uint256 floorPrice = _auction.floorPrice;
    mapping(address => uint256) storage bids = auctIdToBids[_auction.auctionId];
    uint256 newBid = bids[msg.sender] + msg.value;
    require(newBid > floorPrice, "Cannot send bid less than floor price");
    require(newBid >= _auction.highestBid + _auction.bidIncrement, "minimum bid = highest + increment");
    bids[msg.sender] = newBid;
    _auction.highestBidder = msg.sender;
    _auction.highestBid = newBid;
    emit BidPlaced(_auction.auctionId, newBid);
  }

  function _withdraw(Auction storage _auction) internal {
    mapping(address => uint256) storage bids = auctIdToBids[_auction.auctionId];
    address highestBidder = _auction.highestBidder;
    address withdrawalAccount = msg.sender; // initial value

    if (_auction.auctionState == AuctionState.AuctionEnded) {
      if (msg.sender == _auction.tokenOwner) {
        withdrawalAccount = highestBidder;
      } else if (msg.sender == highestBidder) {
        revert("Withdrawal not allowed for highest bidder");
      }
    }
    uint256 withdrawalAmount = bids[withdrawalAccount];
    require(withdrawalAmount > 0, "No funds to withdraw");
    bids[withdrawalAccount] -= withdrawalAmount;
    require(payable(msg.sender).send(withdrawalAmount), "Fund transfer not successful");
  }

  function _getTokenAuctData(Token memory _token)
    internal
    view
    returns (
      uint256 _lenTokenAucts,
      uint256 _indexLastTokenAuct,
      uint256[] storage _tokenAuctIndices
    )
  {
    bytes32 tokenHash = _calcTokenHash(_token);
    _tokenAuctIndices = tokenToAuctIndices[tokenHash];
    _lenTokenAucts = _tokenAuctIndices.length;
    _indexLastTokenAuct = _lenTokenAucts > 0 ? _tokenAuctIndices[_lenTokenAucts - 1] : 0;
  }

  // Helper Functions
  function _calcTokenHash(Token memory _token) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked(_token.tokenAddr, _token.tokenId));
  }

  function _checkIfTokenOwner(Auction storage _auction, address caller) internal view {
    require(_auction.tokenOwner == caller, "Caller is not token owner");
  }

  function _checkIfNotTokenOwner(Auction storage _auction, address caller) internal view {
    require(_auction.tokenOwner != caller, "Caller is token owner");
  }

  function _min(uint256 a, uint256 b) internal pure returns (uint256) {
    if (a < b) return a;
    return b;
  }

  // ERC721 Receiver Interface
  function onERC721Received(
    address operator,
    address from,
    uint256 tokenId,
    bytes calldata data
  ) external virtual override returns (bytes4) {
    operator;
    from;
    tokenId;
    data;
    return IERC721Receiver.onERC721Received.selector;
  }
}
