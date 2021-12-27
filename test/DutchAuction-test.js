const { expect } = require("chai");
const { ethers } = require("hardhat");
const { expectRevert } = require("@openzeppelin/test-helpers");
const timeMachine = require("ether-time-traveler");

const NAME = "FARO Journey Starting";
const SYMBOL = "FAROM";
const TOKEN_URI = "HERE";
const LIST_PRICE = 5;
const LIST_PRICE_AS_ETH = ethers.utils.parseEther(LIST_PRICE.toString());
const LISTING_PERIOD = 30;

const ACCOUNTS_NUM = 20;
const PARTICIPANTS_NUM = 17;
const BUY_AMOUNT = 10;
const SUPPLY = 1000;
const PRICE_DECREMENT = 1;

const AUCTION_STARTED_STATE = "1";
const AUCTION_DEPLOYED_STATE = "0";
const AUCTION_ENDED_STATE = "2";

const SECS_IN_HOUR = 3600;
const FAST_FORWARD_PERIOD1 = 5;
const FAST_FORWARD_PERIOD2 = 10;
const FAST_FORWARD_PERIOD3 = 30 - FAST_FORWARD_PERIOD1 - FAST_FORWARD_PERIOD2;

function getPriceChangeArray(startPrice, timeTicks) {
  const priceChangeArray = [];
  for (let i = 0; i < priceChangeArray.length; i++) {
    priceChangeArray.push(startPrice * Math.pow(2, -i / timeTicks));
  }
  return priceChangeArray;
}

describe("DutchAuction", function () {
  before(async function () {
    await ethers.provider.send("hardhat_reset");
    const accounts = await ethers.provider.listAccounts();
    this.owner = accounts[0];
    this.user = accounts[1];
    this.user2 = accounts[2];
    this.ownerSigner = await ethers.getSigner(this.owner);
    this.projectFundRaisingSigner = await ethers.getSigner(this.user);
    this.nonOwnerSigner = await ethers.getSigner(this.user2);
    this.nonOwnerSignerAgain;

    this.supply = 1000;

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
    this.supply = PARTICIPANTS_NUM * this.fairAlloc;

    const FarownershipToken = await ethers.getContractFactory("Farownership");
    this.farownershipToken = await FarownershipToken.deploy(
      NAME,
      SYMBOL,
      TOKEN_URI
    );
    await this.farownershipToken.deployed();

    const ownershipTokenAddress = this.farownershipToken.address;

    const erc721ContractWithSigner = this.farownershipToken.connect(
      this.ownerSigner
    );
    const mintTx = await erc721ContractWithSigner.mint(this.user);
    await mintTx.wait();

    const ERCVaultFactory = await ethers.getContractFactory(
      "OfferableERC721VaultFactory"
    );
    this.ercVaultFactory = await ERCVaultFactory.deploy();
    await this.ercVaultFactory.deployed();
    const tokenVaultFactoryAddress = this.ercVaultFactory.address;

    const erc721RecipientSigner = this.farownershipToken.connect(
      this.projectFundRaisingSigner
    );
    const approveTx = await erc721RecipientSigner.approve(
      tokenVaultFactoryAddress,
      1
    );
    await approveTx.wait();

    this.factoryWithSigner = this.ercVaultFactory.connect(this.ownerSigner);

    const tx = await this.factoryWithSigner.mint(
      ownershipTokenAddress,
      this.user,
      this.user,
      this.supply,
      LIST_PRICE_AS_ETH,
      LISTING_PERIOD,
      NAME,
      SYMBOL,
      this.funderAddresses,
      this.allocations
    );
    await tx.wait();
    this.offeringAddress = await this.factoryWithSigner.getVault(0);
    this.OfferingVault = await ethers.getContractFactory("FaroOwnership");
    this.offeringVault = await this.OfferingVault.attach(this.offeringAddress);
    this.ownerWithOffering = this.offeringVault.connect(
      this.projectFundRaisingSigner
    );
    this.nonownerWithOffering = this.offeringVault.connect(this.nonOwnerSigner);
    this.participantSigner = this.offeringVault.connect(
      this.offeringParticipants[0]
    );

    this.participantSigner.end();

    const DutchAuctionFactory = await ethers.getContractFactory(
      "DutchAuctionFactory"
    );
    this.dutchAuctionFactory = await DutchAuctionFactory.deploy();
    await this.dutchAuctionFactory.deployed();
    this.dutchAuctionFactoryWithOwnerSigner = this.dutchAuctionFactory.connect(
      this.ownerSigner
    );

    this.dutchAuctionFactoryWithNonOwnerSigner =
      this.dutchAuctionFactory.connect(this.nonOwnerSigner);

    this.listingPrice = await this.ownerWithOffering.getListingPrice();
    const auctionLength = 168;
    const priceChanges = getPriceChangeArray(this.listingPrice, auctionLength);
    this.ethPriceChanges = [];
    for (let i = 0; i < priceChanges.length; i++) {
      this.ethPriceChanges.push(
        ethers.utils.parseEther(priceChanges[i].toString())
      );
    }
  });

  it("Auction cannot be created by non-owner", async function () {
    await expectRevert(
      this.dutchAuctionFactoryWithNonOwnerSigner.createAuction(
        this.offeringAddress,
        this.ethPriceChanges,
        SUPPLY,
        this.funderAddresses
      ),
      "Auction can only be created by offering owner"
    );
  });

  it("Auction can be created by owner of offering", async function () {
    expect(
      (await this.dutchAuctionFactoryWithSigner.getAuctionCount()).toString()
    ).to.equal("0");
    const auctionCreationTx =
      await this.dutchAuctionFactoryWithSigner.createAuction(
        this.offeringAddress,
        this.ethPriceChanges,
        SUPPLY,
        this.funderAddresses
      );
    await auctionCreationTx.wait();
    expect(
      (await this.dutchAuctionFactoryWithSigner.getAuctionCount()).toString()
    ).to.equal("1");
    const dutchAuction =
      await this.dutchAuctionFactoryWithSigner.getLastAuction();
    const DutchAuction = await ethers.getContractFactory("DutchAuction");
    const dutchAuctionObject = await DutchAuction.attach(dutchAuction);
    const dutchAuctionOwnerSigner = dutchAuctionObject.connect(
      this.ownerSigner
    );
    expect(await dutchAuctionOwnerSigner.owner()).to.equal(
      this.ownerSigner.address
    );
    expect(await dutchAuctionOwnerSigner.getAuctionState()).to.equal(
      AUCTION_DEPLOYED_STATE
    );
  });

  it("Auction cannot be started by non-owner", async function () {
    const auction =
      await this.dutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const DutchAuction = await ethers.getContractFactory("DutchAuction");
    const dutchAuctionObject = await DutchAuction.attach(auction);
    const dutchAuctionNonOwnerSigner = dutchAuctionObject.connect(
      this.nonOwnerSigner
    );
    await expectRevert(
      dutchAuctionNonOwnerSigner.start(),
      "This method can only be called by owner"
    );
  });

  it("Auction can be started by owner", async function () {
    const auction =
      await this.dutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const DutchAuction = await ethers.getContractFactory("DutchAuction");
    const dutchAuctionObject = await DutchAuction.attach(auction);
    const dutchAuctionOwnerSigner = dutchAuctionObject.connect(
      this.ownerSigner
    );
    const startTx = await dutchAuctionOwnerSigner.start();
    await startTx.wait();
    expect(
      (await dutchAuctionOwnerSigner.getAuctionState()).toString()
    ).to.equal(AUCTION_STARTED_STATE);
    expect(
      (await dutchAuctionOwnerSigner.getCurrentPrice()).toString()
    ).to.equal(this.listingPrice.toString());
  });

  it("Owner cannot bid", async function () {
    const auction =
      await this.dutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const DutchAuction = await ethers.getContractFactory("DutchAuction");
    const dutchAuctionObject = await DutchAuction.attach(auction);
    const dutchAuctionOwnerSigner = dutchAuctionObject.connect(
      this.ownerSigner
    );
    const currentPrice = await dutchAuctionOwnerSigner.getCurrentPrice();
    await expectRevert(
      dutchAuctionOwnerSigner.bid(BUY_AMOUNT, {
        value: currentPrice,
      }),
      "Owner is not allowed to bid"
    );
  });

  it("Non-owner cannot bid under current price", async function () {
    const auction =
      await this.dutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const DutchAuction = await ethers.getContractFactory("DutchAuction");
    const dutchAuctionObject = await DutchAuction.attach(auction);
    const dutchAuctionNonOwnerSigner = dutchAuctionObject.connect(
      this.nonOwnerSigner
    );
    const currentPrice = await dutchAuctionNonOwnerSigner.getCurrentPrice();
    await expectRevert(
      dutchAuctionNonOwnerSigner.bid(BUY_AMOUNT, {
        value: currentPrice - PRICE_DECREMENT,
      }),
      "Bid value is less than current price."
    );
  });

  it("Non-owner can bid", async function () {
    const auction =
      await this.dutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const DutchAuction = await ethers.getContractFactory("DutchAuction");
    const dutchAuctionObject = await DutchAuction.attach(auction);
    const dutchAuctionNonOwnerSigner = dutchAuctionObject.connect(
      this.nonOwnerSigner
    );
    const projectFundingAddress =
      await dutchAuctionNonOwnerSigner.projectFundingAddress();
    const previousBalance = ethers.provider.getBalance(projectFundingAddress);
    const currentPrice = await dutchAuctionNonOwnerSigner.getCurrentPrice();
    const bidTx = await dutchAuctionNonOwnerSigner.bid(BUY_AMOUNT, {
      value: currentPrice,
    });
    await bidTx.wait();
    expect(
      previousBalance +
        ethers.utils.parseEther(currentPrice * BUY_AMOUNT) -
        -(await ethers.provider.getBalance(projectFundingAddress))
    ).lessThan(Math.pow(10, 9));
    expect(
      (await dutchAuctionNonOwnerSigner.getFractionalBalance()).toString()
    ).to.equal(BUY_AMOUNT.toString());
    expect(
      (await dutchAuctionNonOwnerSigner.getRemaining()).toString()
    ).to.equal((SUPPLY - BUY_AMOUNT).toString());
  });

  it("Can buy again", async function () {
    const auction =
      await this.dutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const DutchAuction = await ethers.getContractFactory("DutchAuction");
    const dutchAuctionObject = await DutchAuction.attach(auction);
    const dutchAuctionNonOwnerSigner = dutchAuctionObject.connect(
      this.nonOwnerSigner
    );
    const projectFundingAddress =
      await dutchAuctionNonOwnerSigner.projectFundingAddress();
    const previousBalance = ethers.provider.getBalance(projectFundingAddress);
    const currentPrice = await dutchAuctionNonOwnerSigner.getCurrentPrice();
    const bidTx = await dutchAuctionNonOwnerSigner.bid(BUY_AMOUNT, {
      value: currentPrice,
    });
    await bidTx.wait();
    const twiceBuyAmount = 2 * BUY_AMOUNT;
    expect(
      previousBalance +
        ethers.utils.parseEther(currentPrice * BUY_AMOUNT) -
        (await ethers.provider.getBalance(projectFundingAddress))
    ).lessThan(Math.pow(10, 9));
    expect(
      (await dutchAuctionNonOwnerSigner.getFractionalBalance()).toString()
    ).to.equal(twiceBuyAmount.toString());
    expect(
      (await dutchAuctionNonOwnerSigner.getRemaining()).toString()
    ).to.equal((SUPPLY - twiceBuyAmount).toString());
  });

  it("Another user can buy ", async function () {
    const auction =
      await this.dutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const DutchAuction = await ethers.getContractFactory("DutchAuction");
    const dutchAuctionObject = await DutchAuction.attach(auction);
    const dutchAuctionNonOwnerSigner = dutchAuctionObject.connect(
      this.nonOwnerSigner2
    );
    const projectFundingAddress =
      await dutchAuctionNonOwnerSigner.projectFundingAddress();
    const previousBalance = ethers.provider.getBalance(projectFundingAddress);
    const currentPrice = await dutchAuctionNonOwnerSigner.getCurrentPrice();
    const bidTx = await dutchAuctionNonOwnerSigner.bid(BUY_AMOUNT, {
      value: currentPrice,
    });
    await bidTx.wait();
    const tripleBuyAmount = 3 * BUY_AMOUNT;
    expect(
      previousBalance +
        ethers.utils.parseEther(currentPrice * BUY_AMOUNT) -
        (await ethers.provider.getBalance(projectFundingAddress))
    ).lessThan(Math.pow(10, 9));
    expect(
      (await dutchAuctionNonOwnerSigner.getFractionalBalance()).toString()
    ).to.equal(BUY_AMOUNT.toString());
    expect(
      (await dutchAuctionNonOwnerSigner.getRemaining()).toString()
    ).to.equal((SUPPLY - tripleBuyAmount).toString());
  });

  it("Price changes over time ", async function () {
    await timeMachine.advanceTimeAndBlock(
      ethers.provider,
      FAST_FORWARD_PERIOD1 * SECS_IN_HOUR
    );
    const auction =
      await this.dutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const DutchAuction = await ethers.getContractFactory("DutchAuction");
    const dutchAuctionObject = await DutchAuction.attach(auction);
    const dutchAuctionNonOwnerSigner = dutchAuctionObject.connect(
      this.nonOwnerSigner2
    );
    expect(
      (await dutchAuctionNonOwnerSigner.getCurrentPrice()).toString()
    ).to.equal(this.ethPriceChanges[FAST_FORWARD_PERIOD1].toString());
  });

  it("Can bid with new price", async function () {
    const auction =
      await this.dutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const DutchAuction = await ethers.getContractFactory("DutchAuction");
    const dutchAuctionObject = await DutchAuction.attach(auction);
    const dutchAuctionNonOwnerSigner = dutchAuctionObject.connect(
      this.nonOwnerSigner2
    );
    const projectFundingAddress =
      await dutchAuctionNonOwnerSigner.projectFundingAddress();
    const previousBalance = ethers.provider.getBalance(projectFundingAddress);
    const currentPrice = await dutchAuctionNonOwnerSigner.getCurrentPrice();
    expect(currentPrice.toString()).to.equal(
      this.ethPriceChanges[5].toString()
    );
    const bidTx = await dutchAuctionNonOwnerSigner.bid(BUY_AMOUNT, {
      value: currentPrice,
    });
    await bidTx.wait();
    const twiceBuyAmount = 2 * BUY_AMOUNT;
    expect(
      previousBalance +
        ethers.utils.parseEther(currentPrice * BUY_AMOUNT) -
        -(await ethers.provider.getBalance(projectFundingAddress))
    ).lessThan(Math.pow(10, 9));
    expect(
      (await dutchAuctionNonOwnerSigner.getFractionalBalance()).toString()
    ).to.equal(twiceBuyAmount.toString());
    expect(
      (await dutchAuctionNonOwnerSigner.getRemaining()).toString()
    ).to.equal((SUPPLY - 2 * twiceBuyAmount).toString());
  });

  it("Cannot buy with less than that but can with higher", async function () {
    const auction =
      await this.dutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const DutchAuction = await ethers.getContractFactory("DutchAuction");
    const dutchAuctionObject = await DutchAuction.attach(auction);
    const dutchAuctionNonOwnerSigner = dutchAuctionObject.connect(
      this.nonOwnerSigner2
    );
    const projectFundingAddress =
      await dutchAuctionNonOwnerSigner.projectFundingAddress();
    const previousBalance = ethers.provider.getBalance(projectFundingAddress);
    const currentPrice = await dutchAuctionNonOwnerSigner.getCurrentPrice();
    await expectRevert(
      dutchAuctionNonOwnerSigner.bid(BUY_AMOUNT, {
        value: currentPrice - PRICE_DECREMENT,
      }),
      "Bid value is less than current price."
    );
    const bidTx = await dutchAuctionNonOwnerSigner.bid(BUY_AMOUNT, {
      value: currentPrice * 3,
    });
    await bidTx.wait();
    const tripleBuyAmount = 3 * BUY_AMOUNT;
    expect(
      previousBalance +
        ethers.utils.parseEther(currentPrice * BUY_AMOUNT) -
        -(await ethers.provider.getBalance(projectFundingAddress))
    ).lessThan(Math.pow(10, 9));
    expect(
      (await dutchAuctionNonOwnerSigner.getFractionalBalance()).toString()
    ).to.equal(tripleBuyAmount.toString());
    expect(
      (await dutchAuctionNonOwnerSigner.getRemaining()).toString()
    ).to.equal((SUPPLY - 5 * BUY_AMOUNT).toString());
  });

  it("Price changes over time again", async function () {
    await timeMachine.advanceTimeAndBlock(
      ethers.provider,
      FAST_FORWARD_PERIOD2 * SECS_IN_HOUR
    );
    const auction =
      await this.dutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const DutchAuction = await ethers.getContractFactory("DutchAuction");
    const dutchAuctionObject = await DutchAuction.attach(auction);
    const dutchAuctionNonOwnerSigner = dutchAuctionObject.connect(
      this.nonOwnerSigner2
    );
    expect(
      (await dutchAuctionNonOwnerSigner.getCurrentPrice()).toString()
    ).to.equal(
      this.ethPriceChanges[
        FAST_FORWARD_PERIOD1 + FAST_FORWARD_PERIOD2
      ].toString()
    );
  });

  it("Cannot buy with less than that but can with higher again", async function () {
    const auction =
      await this.dutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const DutchAuction = await ethers.getContractFactory("DutchAuction");
    const dutchAuctionObject = await DutchAuction.attach(auction);
    const dutchAuctionNonOwnerSigner = dutchAuctionObject.connect(
      this.nonOwnerSigner2
    );
    const projectFundingAddress =
      await dutchAuctionNonOwnerSigner.projectFundingAddress();
    const previousBalance = ethers.provider.getBalance(projectFundingAddress);
    const currentPrice = await dutchAuctionNonOwnerSigner.getCurrentPrice();
    await expectRevert(
      dutchAuctionNonOwnerSigner.bid(BUY_AMOUNT, {
        value: currentPrice - PRICE_DECREMENT,
      }),
      "Bid value is less than current price."
    );
    const bidTx = await dutchAuctionNonOwnerSigner.bid(BUY_AMOUNT, {
      value: currentPrice,
    });
    await bidTx.wait();
    const quadrupleBuyAmount = 4 * BUY_AMOUNT;
    expect(
      previousBalance +
        ethers.utils.parseEther(currentPrice * BUY_AMOUNT) -
        -(await ethers.provider.getBalance(projectFundingAddress))
    ).lessThan(Math.pow(10, 9));
    expect(
      (await dutchAuctionNonOwnerSigner.getFractionalBalance()).toString()
    ).to.equal(quadrupleBuyAmount.toString());
    expect(
      (await dutchAuctionNonOwnerSigner.getRemaining()).toString()
    ).to.equal((SUPPLY - 6 * BUY_AMOUNT).toString());
  });

  it("Price reaches offering price, the auction ends automatically", async function () {
    await timeMachine.advanceTimeAndBlock(
      ethers.provider,
      FAST_FORWARD_PERIOD3 * SECS_IN_HOUR
    );
    const auction =
      await this.dutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const DutchAuction = await ethers.getContractFactory("DutchAuction");
    const dutchAuctionObject = await DutchAuction.attach(auction);
    const dutchAuctionNonOwnerSigner = dutchAuctionObject.connect(
      this.nonOwnerSigner2
    );
    expect(
      (await dutchAuctionNonOwnerSigner.getCurrentPrice()).toString()
    ).to.equal(
      this.ethPriceChanges[
        FAST_FORWARD_PERIOD1 + FAST_FORWARD_PERIOD2 + FAST_FORWARD_PERIOD3
      ].toString()
    );
    expect(
      (await dutchAuctionNonOwnerSigner.getAuctionState()).toString()
    ).to.equal(AUCTION_ENDED_STATE);
  });

  it("Cannot bid on ended auction ", async function () {
    const auction =
      await this.dutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const DutchAuction = await ethers.getContractFactory("DutchAuction");
    const dutchAuctionObject = await DutchAuction.attach(auction);
    const dutchAuctionNonOwnerSigner = dutchAuctionObject.connect(
      this.nonOwnerSigner2
    );
    const projectFundingAddress =
      await dutchAuctionNonOwnerSigner.projectFundingAddress();
    const previousBalance = ethers.provider.getBalance(projectFundingAddress);
    const currentPrice = await dutchAuctionNonOwnerSigner.getCurrentPrice();
    await expectRevert(
      dutchAuctionNonOwnerSigner.bid(BUY_AMOUNT, {
        value: currentPrice - PRICE_DECREMENT,
      }),
      "Auction is not live."
    );
  });
});
