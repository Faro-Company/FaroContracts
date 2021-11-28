//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "./KTLOFractional.sol";


contract OfferableERC721TokenVault is ERC721HolderUpgradeable, PausableUpgradeable {

    IERC20 public constant USDC = IERC20(0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e);

    /// @notice the ERC721 token address of the vault's token
    address private token;

    KTLOFractional private fractional;

    /// @notice The project's funding address where stable coins are to be sent
    address payable private projectFundingAddress;

    address private owner;

    /// @notice Price of the share
    uint256 private listingPrice;

    /// @notice the length of auctions
    uint256 private listingPeriod;

    /// @notice the unix timestamp end time of the token auction
    uint256 private listingEnd;

    enum OfferingState { inactive, live, ended}

    OfferingState private listingState;

    /// @notice a mapping of users to their funding amounts
    mapping(address => uint256) private funders;


    uint256 private remaining;
    uint256 private totalFunding;
    uint256 private totalValue;

    /// @notice An event emitted when a listing starts
    event Start(address starter);

    /// @notice An event emitted when bid happens
    event Bid(address bidder, uint256 amount);

    event CannotBidWhenPaused();

    /// @notice An event emitted when end happens
    event End();

    modifier isOwner() {
        if (msg.sender != owner)
            revert("Sender is not the project owner.");
        _;
    }

    modifier timeTransition() {
        require(listingState == OfferingState.live, "Offering is not live.");
        if (block.timestamp > listingEnd || remaining == 0) {
            _end();
        }
        _;
    }

    function getProjectFundingAddress() public view returns(address payable) {
        return projectFundingAddress;
    }

    function getOfferingState() public view returns (OfferingState) {
        return listingState;
    }

    function getRemainingAllocation(address funder) public view returns(uint256) {
        return funders[funder];
    }

    function getRemaining() public view returns(uint256) {
        return remaining;
    }

    function getListingPrice() public view returns(uint256) {
        return listingPrice;
    }

    function getFractionalBalance(address funder) public view returns(uint256) {
        return fractional.balanceOf(funder);
    }

    function initialize(address _token, address payable _projectFundingAddress, address _owner,
        uint256 _supply, uint256 _listingPrice, uint _listingPeriod, string memory _name, string memory _symbol,
        address[] memory _funderAddresses, uint256[] memory allocations) external initializer {
        // initialize inherited contracts
        __ERC721Holder_init();
        fractional = new KTLOFractional(_name, _symbol, _supply, address(this));
        // set storage variables
        token = _token;
        projectFundingAddress = _projectFundingAddress;
        owner = _owner;
        listingPeriod = _listingPeriod * 1 days;
        listingState = OfferingState.inactive;
        listingPrice = _listingPrice;
        require(_createFundersMapping(_funderAddresses, allocations) == _supply,
            "Given supply is not equal to the sum of allocations");
        remaining = _supply;
        totalValue = _supply * listingPrice;
    }

    function _createFundersMapping(address[] memory _funderAddresses,
        uint256[] memory allocations) internal returns (uint256) {
        require(_funderAddresses.length == allocations.length,
            "Funders and allocation array sizes cannot be different");
        uint256 total;
        for (uint i = 0; i < _funderAddresses.length; i++) {
            funders[_funderAddresses[i]] = allocations[i];
            total += allocations[i];
        }
        return total;
    }

    /// @notice Start the offering
    function start() external isOwner {
        require(listingState == OfferingState.inactive, "Offering is already live");
        listingEnd = block.timestamp + listingPeriod;
        listingState = OfferingState.live;
        emit Start(msg.sender);
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
        // Here increase the gas limit a reasonable amount above the default, and try
        // to send ETH to the recipient.
        // NOTE: This might allow the recipient to attempt a limited reentrancy attack.
        return USDC.transferFrom(from, to, value);
    }

    /// @notice an external function to bid on purchasing the vaults NFT.
    function bid(uint _amount, uint256 _value) external payable timeTransition {
        require(!paused(), "The bid is paused.");
        require(_value > 0, "Funds sent cannot be zero.");
        require(_amount > 0, "Bid amount cannot be zero.");
        require(funders[msg.sender] > 0, "Address is not allowed to participate in the offering.");
        require(funders[msg.sender] >= _amount, "Bid is more than allocated for this address.");
        require(_amount * listingPrice <= _value, "Funds sent for bid is less than the total capital required to buy the amount.");
        require(remaining >= _amount, "Remaining is less than the amount that is bid.");
        remaining -= _amount;
        funders[msg.sender] -= _amount;
        require(sendStableCoin(msg.sender, projectFundingAddress, _value),
            "Could not send the funds to the project offerings address.");
        totalFunding += _value;
        fractional.transfer(msg.sender, _amount);
        emit Bid(msg.sender, _amount);
        if (remaining == 0) {
            _end();
        }
    }

    function _end() internal {
        require(listingState == OfferingState.live, "Offering is already closed.");
        listingState = OfferingState.ended;
        emit End();
    }

    /// @notice an external function to end an auction after the timer has run out
    function end() external isOwner {
        _end();
    }

    function pause() external isOwner {
        _pause();
    }

    function unpause() external isOwner {
        _unpause();
    }

    function getTokenAddress() public view returns (address) {
        return address(fractional);
    }

    function balanceOfFractional(address _holder) public view returns (uint256) {
        return fractional.balanceOf(_holder);
    }

}
