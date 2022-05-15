/* eslint-disable prettier/prettier */
const { expect, use } = require("chai");
const { ethers } = require("hardhat");
const { solidity } = require("ethereum-waffle");
const timeMachine = require("ether-time-traveler");

// use solidity plugin
use(solidity);

const NAME = "FARO Journey Starting";
const SYMBOL = "FAROM";
const TOKEN_URI = "HERE";
const CONTENT_ID = 123456;
const FLOOR_PRICE = ethers.utils.parseEther("1");
const BID_INCREMENT = ethers.utils.parseEther("0.1");
const LESS_BID_INCREMENT = ethers.utils.parseEther("0.09");
const INSUFFICIENT_BID_PRICE = ethers.utils.parseEther("0.8");
const BID_PRICE_MORE_THAN_FLOOR = ethers.utils.parseEther("1.2");
const BID_PRICE_HIGH = ethers.utils.parseEther("2");
const BID_PRICE_HIGHER = ethers.utils.parseEther("4");
const ONE_DAY_IN_SEC = 86400; // 1 day -> 86400 seconds
const AUCTION_PERIOD = 10 * ONE_DAY_IN_SEC;
const AUCTION_PERIOD_TOO_LONG = 400 * ONE_DAY_IN_SEC; // max 1 year in contract
const FAST_FORWARD_PERIOD = AUCTION_PERIOD * 4;

const AuctionState = Object.freeze({
  created: 0,
  started: 1,
  ended: 2,
  cancelled: 3,
});

describe("FARO English Auction Single", function () {
  const testStartTimeStamp = Math.floor(Date.now() / 1000);
  let accounts;
  let contractOwner, nonTokenOwners, tokenOwners;
  let FaroEngAuctSingle, faroEngAuctSingle, faroEngAuctSingleTemp;
  let FaroNFT, faroNFT, faroNFTAddress;
  let tokenIdTemp;
  let signerTemp;

  before(async function () {
    accounts = await ethers.getSigners();
    contractOwner = accounts[0];
    nonTokenOwners = accounts.slice(1, 5);
    tokenOwners = accounts.slice(5, 10);

    FaroEngAuctSingle = await ethers.getContractFactory("FaroEnglishAuctionSingle");
    faroEngAuctSingle = await FaroEngAuctSingle.deploy();
    await faroEngAuctSingle.deployed();

    FaroNFT = await ethers.getContractFactory("FaroNFT");
    faroNFT = await FaroNFT.deploy(NAME, SYMBOL, TOKEN_URI, CONTENT_ID);
    await faroNFT.deployed();
    faroNFTAddress = faroNFT.address;

    for (const [index, account] of tokenOwners.entries()) {
      const faroNFTWithSigner = faroNFT.connect(account);
      const tokenId = index;
      const mintTx = await faroNFTWithSigner.mint(account.address, tokenId);
      await mintTx.wait();

      const approveTx = await faroNFTWithSigner.approve(faroEngAuctSingle.address, tokenId);
      await approveTx.wait();
    }
  });

  it("Auction cannot be created by non-owner", async function () {
    tokenIdTemp = 0;
    signerTemp = nonTokenOwners[0];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(
      faroEngAuctSingleTemp.createAuction(faroNFTAddress, tokenIdTemp, AUCTION_PERIOD, FLOOR_PRICE, BID_INCREMENT)
    ).to.be.revertedWith("ERC721: transfer of token that is not own");
  });

  it("Auction cannot be created by owner of different tokenID", async function () {
    tokenIdTemp = 0;
    signerTemp = nonTokenOwners[1];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(
      faroEngAuctSingleTemp.createAuction(faroNFTAddress, tokenIdTemp, AUCTION_PERIOD, FLOOR_PRICE, BID_INCREMENT)
    ).to.be.revertedWith("ERC721: transfer of token that is not own");
  });

  it("Auction cannot be created when period is too long", async function () {
    tokenIdTemp = 0;
    signerTemp = tokenOwners[0];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(
      faroEngAuctSingleTemp.createAuction(faroNFTAddress, tokenIdTemp, AUCTION_PERIOD_TOO_LONG, FLOOR_PRICE, BID_INCREMENT)
    ).to.be.revertedWith("Auction duration too long");
  });

  it("Auction can be created by owners", async function () {
    for (const [index, tokenOwner] of tokenOwners.entries()) {
      tokenIdTemp = index;
      signerTemp = tokenOwner;
      faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
      await expect(
        faroEngAuctSingleTemp.createAuction(faroNFTAddress, tokenIdTemp, AUCTION_PERIOD, FLOOR_PRICE, BID_INCREMENT)
      ).to.emit(faroEngAuctSingleTemp, "Created");
      const auction = await faroEngAuctSingle.getAuctionbyIndex(index);
      expect(auction.auctionState).to.be.eq(AuctionState.created);
    }
    expect(await faroEngAuctSingle.getTotalAuctionCount()).to.be.eq(tokenOwners.length);
  });

  it("Already created auction with given token address and token ID cannot be created again", async function () {
    tokenIdTemp = 0;
    signerTemp = nonTokenOwners[0];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(
      faroEngAuctSingleTemp.createAuction(faroNFTAddress, tokenIdTemp, AUCTION_PERIOD, FLOOR_PRICE, BID_INCREMENT)
    ).to.be.revertedWith("ERC721: transfer of token that is not own"); // since the token is already in auction contract
  });

  it("Auction cannot be started by nonOwner", async function () {
    tokenIdTemp = 1;
    signerTemp = nonTokenOwners[0];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(faroEngAuctSingleTemp.startAuction(faroNFTAddress, tokenIdTemp)).to.be.revertedWith(
      "Caller is not token owner"
    );
  });

  it("Cannot bid on non-started auction", async function () {
    tokenIdTemp = 1;
    signerTemp = nonTokenOwners[0];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(
      faroEngAuctSingleTemp.bid(faroNFTAddress, tokenIdTemp, { value: BID_PRICE_MORE_THAN_FLOOR })
    ).to.be.revertedWith("Auction is not live");
  });

  it("Auction can be started by owner", async function () {
    for (const [index, tokenOwner] of tokenOwners.entries()) {
      tokenIdTemp = index;
      signerTemp = tokenOwner;
      faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
      await expect(faroEngAuctSingleTemp.startAuction(faroNFTAddress, tokenIdTemp)).to.emit(
        faroEngAuctSingleTemp,
        "Started"
      );
      const auction = await faroEngAuctSingle.getAuctionbyIndex(index);
      expect(auction.auctionState).to.be.eq(AuctionState.started);
      expect(auction.startTime).to.be.gt(testStartTimeStamp);
    }
  });

  it("Cannot make bid with less than floor price", async function () {
    tokenIdTemp = 2;
    signerTemp = nonTokenOwners[0];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(
      faroEngAuctSingleTemp.bid(faroNFTAddress, tokenIdTemp, { value: INSUFFICIENT_BID_PRICE })
    ).to.be.revertedWith("Cannot send bid less than floor price");
  });

  it("Token owner cannot make bid on own auction", async function () {
    tokenIdTemp = 2;
    signerTemp = tokenOwners[2];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(faroEngAuctSingleTemp.bid(faroNFTAddress, tokenIdTemp, { value: BID_PRICE_HIGH })).to.be.revertedWith(
      "Caller is token owner"
    );
  });

  it("Can make bid more than floor price", async function () {
    tokenIdTemp = 2;
    signerTemp = nonTokenOwners[0];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(faroEngAuctSingleTemp.bid(faroNFTAddress, tokenIdTemp, { value: BID_PRICE_HIGH })).to.emit(
      faroEngAuctSingleTemp,
      "BidPlaced"
    );
    const auction = await faroEngAuctSingle.getLastAuctionByToken(faroNFTAddress, tokenIdTemp);
    const userBid = await faroEngAuctSingle.getBidOfAddressByAuctionId(auction.auctionId, signerTemp.address);
    expect(userBid).to.be.eq(BID_PRICE_HIGH);
  });

  it("Can make bid more than floor price to another auction", async function () {
    tokenIdTemp = 3;
    signerTemp = nonTokenOwners[0];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    const tx = await faroEngAuctSingleTemp.bid(faroNFTAddress, tokenIdTemp, { value: BID_PRICE_MORE_THAN_FLOOR });
    await tx.wait();
    const auction = await faroEngAuctSingle.getLastAuctionByToken(faroNFTAddress, tokenIdTemp);
    const userBid = await faroEngAuctSingle.getBidOfAddressByAuctionId(auction.auctionId, signerTemp.address);
    expect(userBid).to.be.eq(BID_PRICE_MORE_THAN_FLOOR);
  });

  it("Non-owner cannot cancel auction", async function () {
    tokenIdTemp = 3;
    signerTemp = nonTokenOwners[0];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(faroEngAuctSingleTemp.cancelAuction(faroNFTAddress, tokenIdTemp)).to.be.revertedWith(
      "Caller is not token owner"
    );
  });

  it("Owner can cancel auction", async function () {
    tokenIdTemp = 3;
    signerTemp = tokenOwners[3];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(faroEngAuctSingleTemp.cancelAuction(faroNFTAddress, tokenIdTemp)).to.emit(
      faroEngAuctSingleTemp,
      "Cancelled"
    );
    const auction = await faroEngAuctSingle.getLastAuctionByToken(faroNFTAddress, tokenIdTemp);
    expect(auction.auctionState).to.be.eq(AuctionState.cancelled);
  });

  it("Cannot bid on cancelled auction", async function () {
    tokenIdTemp = 3;
    signerTemp = nonTokenOwners[0];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(
      faroEngAuctSingleTemp.bid(faroNFTAddress, tokenIdTemp, { value: BID_PRICE_MORE_THAN_FLOOR })
    ).to.be.revertedWith("Auction is not live");
  });

  it("Can withdraw funds back from cancelled auction", async function () {
    tokenIdTemp = 3;
    signerTemp = nonTokenOwners[0];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    const auction = await faroEngAuctSingle.getLastAuctionByToken(faroNFTAddress, tokenIdTemp);
    const userBid = await faroEngAuctSingle.getBidOfAddressByAuctionId(auction.auctionId, signerTemp.address);
    await expect(await faroEngAuctSingleTemp.withdraw(faroNFTAddress, tokenIdTemp)).to.changeEtherBalance(
      signerTemp,
      userBid
    );
  });

  it("Cannot withdraw already withdrawn funds from cancelled auction", async function () {
    tokenIdTemp = 3;
    signerTemp = nonTokenOwners[0];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    const auction = await faroEngAuctSingle.getLastAuctionByToken(faroNFTAddress, tokenIdTemp);
    const userBid = await faroEngAuctSingle.getBidOfAddressByAuctionId(auction.auctionId, signerTemp.address);
    expect(userBid).to.be.eq(0);
    await expect(faroEngAuctSingleTemp.withdraw(faroNFTAddress, tokenIdTemp)).to.be.revertedWith("No funds to withdraw");
  });

  it("Non-Owner cannot withdraw NFT from cancelled auction", async function () {
    tokenIdTemp = 3;
    signerTemp = tokenOwners[2];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(faroEngAuctSingleTemp.withdrawNFT(faroNFTAddress, tokenIdTemp)).to.be.revertedWith("cannot transfer NFT");
  });

  it("Owner can withdraw NFT from cancelled auction", async function () {
    tokenIdTemp = 3;
    signerTemp = tokenOwners[3];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    const tx = await faroEngAuctSingleTemp.withdrawNFT(faroNFTAddress, tokenIdTemp);
    await tx.wait();
    expect(await faroNFT.ownerOf(tokenIdTemp)).to.be.equal(signerTemp.address);
  });

  it("Owner can create and start new auction for same token after cancellation", async function () {
    tokenIdTemp = 3;
    signerTemp = tokenOwners[3];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    const faroNFTTemp = faroNFT.connect(signerTemp);
    const approveTx = await faroNFTTemp.approve(faroEngAuctSingle.address, tokenIdTemp);
    await approveTx.wait();
    let tx = await faroEngAuctSingleTemp.createAuction(
      faroNFTAddress,
      tokenIdTemp,
      AUCTION_PERIOD,
      FLOOR_PRICE,
      BID_INCREMENT
    );
    await tx.wait();
    tx = await faroEngAuctSingleTemp.startAuction(faroNFTAddress, tokenIdTemp);
    await tx.wait();
    const auction = await faroEngAuctSingle.getLastAuctionByToken(faroNFTAddress, tokenIdTemp);
    expect(auction.auctionState).to.be.eq(AuctionState.started);
  });

  it("Reverts when bid not minimum highest+increment", async function () {
    tokenIdTemp = 2;
    signerTemp = nonTokenOwners[1];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(
      faroEngAuctSingleTemp.bid(faroNFTAddress, tokenIdTemp, { value: BID_PRICE_HIGH.add(LESS_BID_INCREMENT) })
    ).to.be.revertedWith("minimum bid = highest + increment");
  });

  it("Can overbid existing highest bidder", async function () {
    tokenIdTemp = 2;
    signerTemp = nonTokenOwners[1];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    const auctionBefore = await faroEngAuctSingle.getLastAuctionByToken(faroNFTAddress, tokenIdTemp);
    const tx = await faroEngAuctSingleTemp.bid(faroNFTAddress, tokenIdTemp, { value: BID_PRICE_HIGH.add(BID_INCREMENT) });
    await tx.wait();
    const userBid = await faroEngAuctSingle.getBidOfAddressByAuctionId(auctionBefore.auctionId, signerTemp.address);
    expect(userBid).to.be.eq(BID_PRICE_HIGH.add(BID_INCREMENT));
    const auctionAfter = await faroEngAuctSingle.getLastAuctionByToken(faroNFTAddress, tokenIdTemp);
    expect(auctionBefore.highestBidder).to.not.equal(auctionAfter.highestBidder);
    expect(auctionAfter.highestBidder).to.equal(signerTemp.address);
    expect(auctionAfter.highestBid).to.be.gt(auctionBefore.highestBid);
  });

  it("Highest bidder can overbid himself", async function () {
    tokenIdTemp = 2;
    signerTemp = nonTokenOwners[1];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    const auctionBefore = await faroEngAuctSingle.getLastAuctionByToken(faroNFTAddress, tokenIdTemp);
    const tx = await faroEngAuctSingleTemp.bid(faroNFTAddress, tokenIdTemp, { value: BID_INCREMENT.mul(2) });
    await tx.wait();
    const userBid = await faroEngAuctSingle.getBidOfAddressByAuctionId(auctionBefore.auctionId, signerTemp.address);
    expect(userBid).to.be.eq(BID_PRICE_HIGH.add(BID_INCREMENT.mul(3)));
    const auctionAfter = await faroEngAuctSingle.getLastAuctionByToken(faroNFTAddress, tokenIdTemp);
    expect(auctionAfter.highestBidder).to.equal(signerTemp.address);
    expect(auctionAfter.highestBid).to.be.gt(auctionBefore.highestBid);
  });

  it("Another account can overbid again", async function () {
    tokenIdTemp = 2;
    signerTemp = nonTokenOwners[2];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    const auctionBefore = await faroEngAuctSingle.getLastAuctionByToken(faroNFTAddress, tokenIdTemp);
    const tx = await faroEngAuctSingleTemp.bid(faroNFTAddress, tokenIdTemp, { value: BID_PRICE_HIGHER });
    await tx.wait();
    const userBid = await faroEngAuctSingle.getBidOfAddressByAuctionId(auctionBefore.auctionId, signerTemp.address);
    expect(userBid).to.be.eq(BID_PRICE_HIGHER);
    const auctionAfter = await faroEngAuctSingle.getLastAuctionByToken(faroNFTAddress, tokenIdTemp);
    expect(auctionBefore.highestBidder).to.not.equal(auctionAfter.highestBidder);
    expect(auctionAfter.highestBidder).to.equal(signerTemp.address);
    expect(auctionAfter.highestBid).to.be.gt(auctionBefore.highestBid);
  });

  it("Cannot withdraw before the auction ends", async function () {
    tokenIdTemp = 2;
    signerTemp = nonTokenOwners[1];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(faroEngAuctSingleTemp.withdraw(faroNFTAddress, tokenIdTemp)).to.be.revertedWith(
      "Auction is still live or in created-state"
    );
  });

  it("Cannot withdraw NFT before the auction ends", async function () {
    tokenIdTemp = 2;
    signerTemp = nonTokenOwners[2];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(faroEngAuctSingleTemp.withdrawNFT(faroNFTAddress, tokenIdTemp)).to.be.revertedWith(
      "Auction is still live or in created-state"
    );
  });

  it("Cannot trigger end before the end time", async function () {
    tokenIdTemp = 2;
    signerTemp = nonTokenOwners[2];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(faroEngAuctSingleTemp.endAuction(faroNFTAddress, tokenIdTemp)).to.be.revertedWith(
      "Auction cannot be ended"
    );
  });

  it("Cannot participate after the auction ends", async function () {
    tokenIdTemp = 2;
    signerTemp = nonTokenOwners[2];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await timeMachine.advanceTimeAndBlock(ethers.provider, FAST_FORWARD_PERIOD);
    await expect(faroEngAuctSingleTemp.bid(faroNFTAddress, tokenIdTemp, { value: BID_PRICE_HIGHER })).to.be.revertedWith(
      "Auction is not live"
    );
  });

  it("Auctions have already ended", async function () {
    for (const [index, tokenOwner] of tokenOwners.entries()) {
      tokenIdTemp = index;
      signerTemp = tokenOwner;
      faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
      const auctionBefore = await faroEngAuctSingle.getAuctionbyIndex(index);
      if (auctionBefore.auctionState === AuctionState.started) {
        await expect(faroEngAuctSingleTemp.endAuction(faroNFTAddress, tokenIdTemp)).to.emit(faroEngAuctSingleTemp, "Ended");
        const auctionAfter = await faroEngAuctSingle.getAuctionbyIndex(index);
        expect(auctionAfter.auctionState).to.be.eq(AuctionState.ended);
      }
    }
  });

  it("Cannot start already ended auction", async function () {
    for (const [index, tokenOwner] of tokenOwners.entries()) {
      tokenIdTemp = index;
      signerTemp = tokenOwner;
      faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
      await expect(faroEngAuctSingleTemp.startAuction(faroNFTAddress, tokenIdTemp)).to.be.revertedWith(
        "Auction is not in created-state"
      );
    }
  });

  it("Owner cannot withdraw from an auction where no bids were placed", async function () {
    tokenIdTemp = 4;
    signerTemp = tokenOwners[4];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(faroEngAuctSingleTemp.withdraw(faroNFTAddress, tokenIdTemp)).to.be.revertedWith("No funds to withdraw");
  });

  it("Owner can withdraw the auction item(NFT) from an auction where no bids were placed", async function () {
    tokenIdTemp = 4;
    signerTemp = tokenOwners[4];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    const tx = await faroEngAuctSingleTemp.withdrawNFT(faroNFTAddress, tokenIdTemp);
    await tx.wait();
    expect(await faroNFT.ownerOf(tokenIdTemp)).to.be.equal(signerTemp.address);
  });

  it("Non-bidder cannot withdraw auction item(NFT)", async function () {
    tokenIdTemp = 2;
    signerTemp = nonTokenOwners[3];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(faroEngAuctSingleTemp.withdrawNFT(faroNFTAddress, tokenIdTemp)).to.be.revertedWith("cannot transfer NFT");
  });

  it("Non-bidder cannot withdraw", async function () {
    tokenIdTemp = 2;
    signerTemp = nonTokenOwners[3];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(faroEngAuctSingleTemp.withdraw(faroNFTAddress, tokenIdTemp)).to.be.revertedWith("No funds to withdraw");
  });

  it("Not-Winner cannot withdraw auction item (NFT)", async function () {
    tokenIdTemp = 2;
    signerTemp = nonTokenOwners[1];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(faroEngAuctSingleTemp.withdrawNFT(faroNFTAddress, tokenIdTemp)).to.be.revertedWith("cannot transfer NFT");
  });

  it("Not-Winner can withdraw its funds", async function () {
    tokenIdTemp = 2;
    signerTemp = nonTokenOwners[1];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    const auction = await faroEngAuctSingle.getLastAuctionByToken(faroNFTAddress, tokenIdTemp);
    const userBid = await faroEngAuctSingle.getBidOfAddressByAuctionId(auction.auctionId, signerTemp.address);
    expect(userBid).to.be.eq(BID_PRICE_HIGH.add(BID_INCREMENT.mul(3)));
    await expect(await faroEngAuctSingleTemp.withdraw(faroNFTAddress, tokenIdTemp)).to.changeEtherBalance(
      signerTemp,
      userBid
    );
  });

  it("Not-Winner cannot withdraw again", async function () {
    tokenIdTemp = 2;
    signerTemp = nonTokenOwners[1];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(faroEngAuctSingleTemp.withdraw(faroNFTAddress, tokenIdTemp)).to.be.revertedWith("No funds to withdraw");
  });

  it("Previous owner cannot create another auction with the same NFT although the auction ended", async function () {
    tokenIdTemp = 2;
    signerTemp = tokenOwners[2];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(
      faroEngAuctSingleTemp.createAuction(faroNFTAddress, tokenIdTemp, AUCTION_PERIOD, FLOOR_PRICE, BID_INCREMENT)
    ).to.be.revertedWith("ERC721: transfer of token that is not own");
  });

  it("Previous Owner cannot withdraw auction item (NFT)", async function () {
    tokenIdTemp = 2;
    signerTemp = tokenOwners[2];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(faroEngAuctSingleTemp.withdrawNFT(faroNFTAddress, tokenIdTemp)).to.be.revertedWith("cannot transfer NFT");
  });

  it("Winner cannot create a new auction with the NFT before withdrawing it", async function () {
    tokenIdTemp = 2;
    signerTemp = nonTokenOwners[2];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(
      faroEngAuctSingleTemp.createAuction(faroNFTAddress, tokenIdTemp, AUCTION_PERIOD, FLOOR_PRICE, BID_INCREMENT)
    ).to.be.revertedWith("ERC721: transfer of token that is not own");
  });

  it("Winner can withdraw the auction item(NFT)", async function () {
    tokenIdTemp = 2;
    signerTemp = nonTokenOwners[2];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    const tx = await faroEngAuctSingleTemp.withdrawNFT(faroNFTAddress, tokenIdTemp);
    await tx.wait();
    expect(await faroNFT.ownerOf(tokenIdTemp)).to.be.equal(signerTemp.address);
  });

  it("Winner cannot attempt to withdraw the NFT again", async function () {
    tokenIdTemp = 2;
    signerTemp = nonTokenOwners[2];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(faroEngAuctSingleTemp.withdrawNFT(faroNFTAddress, tokenIdTemp)).to.be.revertedWith(
      "ERC721: transfer caller is not owner nor approved"
    );
  });

  it("Winner not allowed to withdraw funds", async function () {
    tokenIdTemp = 2;
    signerTemp = nonTokenOwners[2];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(faroEngAuctSingleTemp.withdraw(faroNFTAddress, tokenIdTemp)).to.be.revertedWith(
      "Withdrawal not allowed for highest bidder"
    );
  });

  it("Previous Owner can withdraw highest bid", async function () {
    tokenIdTemp = 2;
    signerTemp = tokenOwners[2];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    const auction = await faroEngAuctSingle.getLastAuctionByToken(faroNFTAddress, tokenIdTemp);
    const userBid = await faroEngAuctSingle.getBidOfAddressByAuctionId(auction.auctionId, signerTemp.address);
    expect(userBid).to.be.eq(0);
    await expect(await faroEngAuctSingleTemp.withdraw(faroNFTAddress, tokenIdTemp)).to.changeEtherBalance(
      signerTemp,
      auction.highestBid
    );
  });

  it("Previous Owner cannot withdraw again", async function () {
    tokenIdTemp = 2;
    signerTemp = tokenOwners[2];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(faroEngAuctSingleTemp.withdraw(faroNFTAddress, tokenIdTemp)).to.be.revertedWith("No funds to withdraw");
  });

  it("Winner can create another auction with the same token and token ID if existing one is ended and he's already withdrawn the NFT", async function () {
    tokenIdTemp = 2;
    signerTemp = nonTokenOwners[2];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    const faroNFTTemp = faroNFT.connect(signerTemp);
    const approveTx = await faroNFTTemp.approve(faroEngAuctSingle.address, tokenIdTemp);
    await approveTx.wait();
    const tx = await faroEngAuctSingleTemp.createAuction(
      faroNFTAddress,
      tokenIdTemp,
      AUCTION_PERIOD,
      FLOOR_PRICE,
      BID_INCREMENT
    );
    await tx.wait();
    const auction = await faroEngAuctSingle.getLastAuctionByToken(faroNFTAddress, tokenIdTemp);
    expect(auction.auctionState).to.be.eq(AuctionState.created);
  });

  it("Only owner can pause the contract", async function () {
    signerTemp = tokenOwners[3];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(faroEngAuctSingleTemp.pause()).to.be.revertedWith("Ownable: caller is not the owner");
    signerTemp = contractOwner;
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    const tx = await faroEngAuctSingleTemp.pause();
    await tx.wait();
    expect(await faroEngAuctSingleTemp.paused()).to.be.equal(true);
  });

  it("Auction cannot be created when paused", async function () {
    tokenIdTemp = 0;
    signerTemp = tokenOwners[0];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(
      faroEngAuctSingleTemp.createAuction(faroNFTAddress, tokenIdTemp, AUCTION_PERIOD, FLOOR_PRICE, BID_INCREMENT)
    ).to.be.revertedWith("Pausable: paused");
  });

  it("Only owner can unpause the contract", async function () {
    signerTemp = tokenOwners[0];
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    await expect(faroEngAuctSingleTemp.unpause()).to.be.revertedWith("Ownable: caller is not the owner");
    signerTemp = contractOwner;
    faroEngAuctSingleTemp = await faroEngAuctSingle.connect(signerTemp);
    const tx = await faroEngAuctSingleTemp.unpause();
    await tx.wait();
    expect(await faroEngAuctSingleTemp.paused()).to.be.equal(false);
  });
});
