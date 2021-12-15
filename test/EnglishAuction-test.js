const { expect } = require("chai");
const { ethers } = require("hardhat");
const { expectRevert } = require("@openzeppelin/test-helpers");
const timeMachine = require("ether-time-traveler");

const NAME = "FARO Journey Starting";
const SYMBOL = "FAROM";
const TOKEN_URI = "HERE";
const FLOOR_PRICE = 5;
const INSUFFICIENT_BID_PRICE = "2";
const BID_PRICE_MORE_THAN_FLOOR = "8";
const BID_PRICE_LOWER_THAN_HIGH = "6";
const BID_PRICE_LOWER_THAN_HIGH_DOUBLED = "12";
const BID_PRICE_MORE_THAN_FLOOR_DOUBLED = "16";

const AUCTION_PERIOD = 600;
const FAST_FORWARD_PERIOD = 4 * AUCTION_PERIOD;
const BID_INCREMENT = 1;

const CONTENT_ID = 123456;

const ACCOUNTS_NUM = 20;
const PARTICIPANTS_NUM = 17;
const SAMPLE_TOKEN_ID = 1;

const AUCTION_STARTED_STATE = "1";
const AUCTION_DEPLOYED_STATE = "0";
const AUCTION_ENDED_STATE = "2";
const AUCTION_CANCELLED_STATE = "3";

describe("EnglishAuction", function () {
  before(async function () {
    const accounts = await ethers.provider.listAccounts();
    this.owner = accounts[0];
    this.user = accounts[1];
    this.user2 = accounts[2];
    this.ownerSigner = await ethers.getSigner(this.owner);
    this.nftHolder = await ethers.getSigner(this.user);
    this.distributor = await ethers.getSigner(this.user2);

    this.supply = 10000000;

    let participantWallet;
    let participantAddress;

    this.offeringParticipants = [];
    this.funderAddresses = [];
    this.allocations = [];

    this.fairAlloc = Math.floor(this.supply / PARTICIPANTS_NUM);

    for (let i = 3; i < ACCOUNTS_NUM; i++) {
      participantAddress = accounts[i];
      participantWallet = await ethers.getSigner(participantAddress);
      this.offeringParticipants.push(participantWallet);
      this.funderAddresses.push(participantAddress);
      this.allocations.push(this.fairAlloc);
    }

    const KtlNFT = await ethers.getContractFactory("FaroNFT");
    this.ktlNFT = await KtlNFT.deploy(NAME, SYMBOL, TOKEN_URI, CONTENT_ID);
    await this.ktlNFT.deployed();
    const erc721ContractWithSigner = this.ktlNFT.connect(this.ownerSigner);

    const EnglishAuctionFactory = await ethers.getContractFactory(
      "EnglishAuctionFactory"
    );
    this.englishAuctionFactory = await EnglishAuctionFactory.deploy();
    await this.englishAuctionFactory.deployed();
    const englishAuctionFactoryAddress = this.englishAuctionFactory.address;

    let wallet;
    let signer;
    let balance;
    this.signers = [];
    this.wallets = [];
    this.initialBalances = [];
    let tokenId;
    for (let i = 3; i < ACCOUNTS_NUM; i++) {
      tokenId = i - 3;
      const mintTx = await erc721ContractWithSigner.mint(accounts[i], tokenId);
      await mintTx.wait();
      wallet = await ethers.getSigner(accounts[i]);
      this.wallets.push(wallet);
      signer = this.ktlNFT.connect(wallet);
      const approveTx = await signer.approve(
        englishAuctionFactoryAddress,
        tokenId
      );
      await approveTx.wait();
      signer = this.englishAuctionFactory.connect(wallet);
      this.signers.push(signer);
      balance = await wallet.getBalance();
      this.initialBalances.push(balance);
    }

    this.factoryWithNonOwner = this.englishAuctionFactory.connect(
      this.distributor
    );
  });

  it("Auction cannot be created by non-owner", async function () {
    await expectRevert(
      this.factoryWithNonOwner.createAuction(
        BID_INCREMENT,
        AUCTION_PERIOD,
        this.ktlNFT.address,
        SAMPLE_TOKEN_ID,
        FLOOR_PRICE
      ),
      "Auction can only be deployed by the owner of the token."
    );
  });

  it("Auction cannot be created by owner of different tokenID", async function () {
    await expectRevert(
      this.signers[0].createAuction(
        BID_INCREMENT,
        AUCTION_PERIOD,
        this.ktlNFT.address,
        SAMPLE_TOKEN_ID,
        FLOOR_PRICE
      ),
      "Auction can only be deployed by the owner of the token."
    );
  });

  it("Auction can be created by owners", async function () {
    let participantSigner, tx, auctionAddress;
    for (let i = 0; i < this.signers.length; i++) {
      participantSigner = this.signers[i];
      tx = await participantSigner.createAuction(
        BID_INCREMENT,
        AUCTION_PERIOD,
        this.ktlNFT.address,
        i,
        FLOOR_PRICE
      );
      await tx.wait();
      expect((await participantSigner.getAuctionCount()).toString()).to.equal(
        (i + 1).toString()
      );
      auctionAddress = await participantSigner.getAuction(i);
      const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
      const englishAuction = await EnglishAuction.attach(auctionAddress);
      participantSigner = englishAuction.connect(this.wallets[0]);
      expect((await participantSigner.getAuctionState()).toString()).to.equal(
        AUCTION_DEPLOYED_STATE
      );
    }
  });

  it("Auction cannot be started by nonOwner", async function () {
    const participantSigner = this.signers[0];
    const lastAuction = await participantSigner.getLastAuction();
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(lastAuction);
    const auctionSigner = englishAuction.connect(this.wallets[0]);
    await expectRevert(
      auctionSigner.start(),
      "Only owner can perform this operation."
    );
  });

  it("Cannot bid on non-started auction", async function () {
    const lastAuction = await this.signers[0].getLastAuction();
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(lastAuction);
    const participantSigner = englishAuction.connect(this.wallets[0]);
    await expectRevert(participantSigner.bid(), "Auction is not live.");
  });

  it("Auction can be started by owner", async function () {
    let participantSigner, tx, auctionAddress, englishAuction;
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    for (let i = 0; i < this.signers.length; i++) {
      participantSigner = this.signers[i];
      auctionAddress = await participantSigner.getAuction(i);
      englishAuction = await EnglishAuction.attach(auctionAddress);
      participantSigner = englishAuction.connect(this.wallets[i]);
      tx = await participantSigner.start();
      await tx.wait();
      expect((await participantSigner.getAuctionState()).toString()).to.equal(
        AUCTION_STARTED_STATE
      );
    }
  });

  it("Cannot make bid with less than floor price", async function () {
    const lastAuction = await this.signers[0].getLastAuction();
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(lastAuction);
    const participantSigner = englishAuction.connect(this.wallets[0]);
    await expectRevert(
      participantSigner.bid({
        value: ethers.utils.parseEther(INSUFFICIENT_BID_PRICE),
      }),
      "Cannot send bid less than floor price."
    );
  });

  it("Can make bid more than floor price", async function () {
    const lastAuction = await this.signers[0].getLastAuction();
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(lastAuction);
    const participantSigner = englishAuction.connect(this.wallets[0]);
    const tx = await participantSigner.bid({
      value: ethers.utils.parseEther(BID_PRICE_MORE_THAN_FLOOR),
    });
    await tx.wait();
    expect((await participantSigner.getHighestBid()).toString()).to.equal(
      ethers.utils.parseEther(BID_PRICE_MORE_THAN_FLOOR).toString()
    );
  });

  it("Can make bid more than floor price to another auction", async function () {
    const firstAuction = await this.signers[0].getAuction(3);
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(firstAuction);
    const participantSigner = englishAuction.connect(this.wallets[0]);
    const tx = await participantSigner.bid({
      value: ethers.utils.parseEther(BID_PRICE_MORE_THAN_FLOOR),
    });
    await tx.wait();
    expect((await participantSigner.getHighestBid()).toString()).to.equal(
      ethers.utils.parseEther(BID_PRICE_MORE_THAN_FLOOR).toString()
    );
  });

  it("Non-owner cannot cancel auction ", async function () {
    const firstAuction = await this.signers[0].getAuction(3);
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(firstAuction);
    const participantSigner = englishAuction.connect(this.wallets[0]);
    await expectRevert(
      participantSigner.cancelAuction(),
      "Only owner can perform this operation."
    );
  });

  it("Owner can cancel auction ", async function () {
    const firstAuction = await this.signers[0].getAuction(3);
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(firstAuction);
    const participantSigner = englishAuction.connect(this.wallets[3]);
    const tx = await participantSigner.cancelAuction();
    await tx.wait();
    expect((await participantSigner.getAuctionState()).toString()).to.equal(
      AUCTION_CANCELLED_STATE
    );
  });

  it("Cannot bid on cancelled auction ", async function () {
    const firstAuction = await this.signers[0].getAuction(3);
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(firstAuction);
    const participantSigner = englishAuction.connect(this.wallets[0]);
    await expectRevert(
      participantSigner.bid({
        value: ethers.utils.parseEther(BID_PRICE_MORE_THAN_FLOOR),
      }),
      "Auction is not live."
    );
  });

  it("Can withdraw funds back from cancelled auction", async function () {
    const lastAuction = await this.signers[0].getAuction(3);
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(lastAuction);
    const participantSigner = englishAuction.connect(this.wallets[0]);
    const participantAddress = this.wallets[0].address;
    const preWithdrawBid = await participantSigner.getBidForAnAddress(
      participantAddress
    );
    const tx = await participantSigner.withdraw();
    await tx.wait();
    const postWithdrawBid = await participantSigner.getBidForAnAddress(
      participantAddress
    );
    expect(postWithdrawBid).to.not.equal(preWithdrawBid);
  });

  it("Non-owner Cannot withdraw NFT from cancelled auction", async function () {
    const lastAuction = await this.signers[0].getAuction(3);
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(lastAuction);
    const participantSigner = englishAuction.connect(this.wallets[0]);
    await expectRevert(
      participantSigner.withdrawNFT(),
      "Auction must be ended for this operation."
    );
  });

  it("Owner can withdraw NFT from cancelled auction", async function () {
    const lastAuction = await this.signers[0].getAuction(3);
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(lastAuction);
    const participantSigner = englishAuction.connect(this.wallets[3]);
    const tx = await participantSigner.withdrawNFTWhenCancelled();
    await tx.wait();
    expect((await this.ktlNFT.ownerOf(3)).toString()).to.equal(
      this.wallets[3].address
    );
  });

  it("Cannot change highest bidder by offering a lower bid price", async function () {
    const lastAuction = await this.signers[0].getLastAuction();
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(lastAuction);
    const participantSigner = englishAuction.connect(this.wallets[1]);
    const tx = await participantSigner.bid({
      value: ethers.utils.parseEther(BID_PRICE_LOWER_THAN_HIGH),
    });
    await tx.wait();
    const secondParticipantSigner = englishAuction.connect(this.wallets[2]);
    expect(
      (
        await secondParticipantSigner.getBidForAnAddress(
          this.wallets[1].address
        )
      ).toString()
    ).to.equal(ethers.utils.parseEther(BID_PRICE_LOWER_THAN_HIGH).toString());
    expect((await secondParticipantSigner.highestBidder()).toString()).to.equal(
      this.wallets[0].address
    );
  });

  it("Can change highest bid by putting more amount", async function () {
    const lastAuction = await this.signers[0].getLastAuction();
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(lastAuction);
    const participantSigner = englishAuction.connect(this.wallets[1]);
    const tx = await participantSigner.bid({
      value: ethers.utils.parseEther(BID_PRICE_LOWER_THAN_HIGH),
    });
    await tx.wait();
    const secondParticipantSigner = englishAuction.connect(this.wallets[2]);
    expect(
      (
        await secondParticipantSigner.getBidForAnAddress(
          this.wallets[1].address
        )
      ).toString()
    ).to.equal(
      ethers.utils.parseEther(BID_PRICE_LOWER_THAN_HIGH_DOUBLED).toString()
    );
    expect((await secondParticipantSigner.highestBidder()).toString()).to.equal(
      this.wallets[1].address
    );
  });

  it("Can change bids by putting more amount to existing again", async function () {
    const lastAuction = await this.signers[0].getLastAuction();
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(lastAuction);
    const participantSigner = englishAuction.connect(this.wallets[0]);
    const tx = await participantSigner.bid({
      value: ethers.utils.parseEther(BID_PRICE_MORE_THAN_FLOOR),
    });
    await tx.wait();
    const secondParticipantSigner = englishAuction.connect(this.wallets[2]);
    expect(
      (
        await secondParticipantSigner.getBidForAnAddress(
          this.wallets[0].address
        )
      ).toString()
    ).to.equal(
      ethers.utils.parseEther(BID_PRICE_MORE_THAN_FLOOR_DOUBLED).toString()
    );
    expect((await secondParticipantSigner.highestBidder()).toString()).to.equal(
      this.wallets[0].address
    );
  });

  it("Cannot withdraw before the auction ends", async function () {
    const lastAuction = await this.signers[0].getLastAuction();
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(lastAuction);
    const participantSigner = englishAuction.connect(this.wallets[2]);
    await expectRevert(
      participantSigner.withdraw(),
      "Auction did not end or was cancelled."
    );
  });

  it("Winner cannot withdraw the item before the auction ends", async function () {
    const lastAuction = await this.signers[0].getLastAuction();
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(lastAuction);
    const participantSigner = englishAuction.connect(this.wallets[2]);
    await expectRevert(
      participantSigner.withdrawNFT(),
      "Auction must be ended for this operation."
    );
  });

  it("Cannot trigger end before the end time", async function () {
    const lastAuction = await this.signers[0].getLastAuction();
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(lastAuction);
    const participantSigner = englishAuction.connect(this.wallets[2]);
    const tx = await participantSigner.triggerEnd();
    tx.wait();
    expect((await participantSigner.getAuctionState()).toString()).to.equal(
      AUCTION_STARTED_STATE
    );
  });

  it("Cannot participate after the auction ends", async function () {
    const lastAuction = await this.signers[0].getLastAuction();
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(lastAuction);
    const participantSigner = englishAuction.connect(this.wallets[2]);
    await timeMachine.advanceTimeAndBlock(ethers.provider, FAST_FORWARD_PERIOD);
    await expectRevert(
      participantSigner.bid({
        value: ethers.utils.parseEther(BID_PRICE_MORE_THAN_FLOOR),
      }),
      "Auction is not live."
    );
  });

  it("Auctions have already ended", async function () {
    let tx, auction, participantSigner, engAuction, EngAuction;
    for (let i = 0; i < this.signers.length; i++) {
      if (i === 3) continue;
      auction = await this.signers[0].getAuction(i);
      EngAuction = await ethers.getContractFactory("EnglishAuction");
      engAuction = await EngAuction.attach(auction);
      participantSigner = engAuction.connect(this.wallets[2]);
      tx = await participantSigner.triggerEnd();
      tx.wait();
      expect((await participantSigner.getAuctionState()).toString()).to.equal(
        AUCTION_ENDED_STATE
      );
    }
  });

  it("Cannot start the already ended auction", async function () {
    const lastAuction = await this.signers[0].getAuction(2);
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(lastAuction);
    const participantSigner = englishAuction.connect(this.wallets[2]);
    await expectRevert(participantSigner.start(), "Auction's already started");
  });

  it("Non-bidder cannot withdraw auction item", async function () {
    const lastAuction = await this.signers[0].getLastAuction();
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(lastAuction);
    const participantSigner = englishAuction.connect(this.wallets[4]);
    await expectRevert(
      participantSigner.withdrawNFT(),
      "Only the highest bidder can withdraw the auction item."
    );
  });

  it("Non-bidder cannot withdrawal", async function () {
    const lastAuction = await this.signers[0].getLastAuction();
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(lastAuction);
    const participantSigner = englishAuction.connect(this.wallets[4]);
    await expectRevert(
      participantSigner.withdraw(),
      "Sender has no bids to withdraw."
    );
  });

  it("Not winner cannot withdraw auction item", async function () {
    const lastAuction = await this.signers[0].getLastAuction();
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(lastAuction);
    const participantSigner = englishAuction.connect(this.wallets[1]);
    await expectRevert(
      participantSigner.withdrawNFT(),
      "Only the highest bidder can withdraw the auction item."
    );
  });

  it("Not winner can withdraw its funds", async function () {
    const lastAuction = await this.signers[0].getLastAuction();
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(lastAuction);
    const participantSigner = englishAuction.connect(this.wallets[1]);
    const tx = await participantSigner.withdraw();
    await tx.wait();
    expect(
      (
        await participantSigner.getBidForAnAddress(this.wallets[1].address)
      ).toString()
    ).to.equal("0");
  });

  it("Not winner cannot withdraw its funds again", async function () {
    const lastAuction = await this.signers[0].getLastAuction();
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(lastAuction);
    const participantSigner = englishAuction.connect(this.wallets[1]);
    await expectRevert(
      participantSigner.withdraw(),
      "Sender has no bids to withdraw."
    );
  });

  it("Winner can withdraw the NFT", async function () {
    const lastAuction = await this.signers[0].getLastAuction();
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(lastAuction);
    const participantSigner = englishAuction.connect(this.wallets[0]);
    const tx = await participantSigner.withdrawNFT();
    await tx.wait();
    this.ktlNFT.connect(this.wallets[2]);
    expect(
      (await this.ktlNFT.ownerOf(PARTICIPANTS_NUM - 1)).toString()
    ).to.equal(this.wallets[0].address);
  });

  it("Winner cannot attempt to withdraw the NFT again", async function () {
    const lastAuction = await this.signers[0].getLastAuction();
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(lastAuction);
    const participantSigner = englishAuction.connect(this.wallets[0]);
    await expectRevert(
      participantSigner.withdrawNFT(),
      "ERC721: transfer caller is not owner nor approved"
    );
  });

  it("Winner can withdraw the funds if higher than highest binding bid ", async function () {
    const lastAuction = await this.signers[0].getLastAuction();
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(lastAuction);
    const participantSigner = englishAuction.connect(this.wallets[0]);
    const bindingBid = await participantSigner.highestBindingBid();
    const highestBid = await participantSigner.getHighestBid();
    expect(highestBid - bindingBid).to.be.above(0);
    const tx = await participantSigner.withdraw();
    await tx.wait();
    expect(
      await participantSigner.getBidForAnAddress(this.wallets[0].address)
    ).to.equal(bindingBid.toString());
  });

  it("Winner cannot withdraw again ", async function () {
    const lastAuction = await this.signers[0].getLastAuction();
    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = await EnglishAuction.attach(lastAuction);
    const participantSigner = englishAuction.connect(this.wallets[0]);
    await expectRevert(
      participantSigner.withdraw(),
      "Withdrawal amount cannot be 0."
    );
  });
});
