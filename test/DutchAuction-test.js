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

const SECS_IN_DAY = 86400;
const FAST_FORWARD_PERIOD1 = 5;
const FAST_FORWARD_PERIOD2 = 10;
const FAST_FORWARD_PERIOD3 = 30 - FAST_FORWARD_PERIOD1 - FAST_FORWARD_PERIOD2;

function getPriceChangeArray(endPrice, timeTicks) {
  const priceChangeArray = [];
  const startPrice = endPrice * 2;
  for (let i = 0; i < timeTicks; i++) {
    priceChangeArray.push(startPrice * Math.pow(2, -i / timeTicks));
  }
  return priceChangeArray;
}

describe("FaroDutchAuction", function () {
  before(async function () {
    await ethers.provider.send("hardhat_reset");
    const accounts = await ethers.provider.listAccounts();
    this.owner = accounts[0];
    this.user = accounts[1];
    this.user2 = accounts[2];
    this.user3 = accounts[3];
    this.ownerSigner = await ethers.getSigner(this.owner);
    this.projectFundRaisingSigner = await ethers.getSigner(this.user);
    this.nonOwnerSigner = await ethers.getSigner(this.user2);
    this.nonOwnerSigner2 = await ethers.getSigner(this.user3);

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
      "FaroOfferingFactory"
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
    this.offeringAddress = await this.factoryWithSigner.getOffering(0);
    this.OfferingVault = await ethers.getContractFactory("FaroOffering");
    this.offeringVault = await this.OfferingVault.attach(this.offeringAddress);
    this.ownerWithOffering = this.offeringVault.connect(
      this.projectFundRaisingSigner
    );
    this.nonownerWithOffering = this.offeringVault.connect(this.nonOwnerSigner);

    const startTx = await this.ownerWithOffering.start();
    await startTx.wait();

    const endTx = await this.ownerWithOffering.end();
    await endTx.wait();

    expect((await this.ownerWithOffering.offeringState()).toString()).to.equal(
      "2"
    );
    const FaroDutchAuctionFactory = await ethers.getContractFactory(
      "FaroDutchAuctionFactory"
    );
    this.faroDutchAuctionFactory = await FaroDutchAuctionFactory.deploy();
    await this.faroDutchAuctionFactory.deployed();
    this.faroDutchAuctionFactoryWithOwnerSigner =
      this.faroDutchAuctionFactory.connect(this.projectFundRaisingSigner);

    this.faroDutchAuctionFactoryWithNonOwnerSigner =
      this.faroDutchAuctionFactory.connect(this.nonOwnerSigner);

    this.listingPrice = ethers.utils.formatEther(
      await this.ownerWithOffering.listingPrice()
    );
    this.startPrice = ethers.utils.parseEther(
      (2 * this.listingPrice).toString()
    );
    const auctionLength = 31;
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
      this.faroDutchAuctionFactoryWithNonOwnerSigner.createAuction(
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
      (
        await this.faroDutchAuctionFactoryWithOwnerSigner.getAuctionCount()
      ).toString()
    ).to.equal("0");
    const auctionCreationTx =
      await this.faroDutchAuctionFactoryWithOwnerSigner.createAuction(
        this.offeringAddress,
        this.ethPriceChanges,
        SUPPLY,
        this.funderAddresses
      );
    await auctionCreationTx.wait();
    expect(
      (
        await this.faroDutchAuctionFactoryWithOwnerSigner.getAuctionCount()
      ).toString()
    ).to.equal("1");
    const faroDutchAuction =
      await this.faroDutchAuctionFactoryWithOwnerSigner.getLastAuction();
    const FaroDutchAuction = await ethers.getContractFactory(
      "FaroDutchAuction"
    );
    const faroDutchAuctionObject = await FaroDutchAuction.attach(
      faroDutchAuction
    );
    const faroDutchAuctionOwnerSigner = faroDutchAuctionObject.connect(
      this.ownerSigner
    );
    expect(await faroDutchAuctionOwnerSigner.owner()).to.equal(
      this.projectFundRaisingSigner.address
    );
    expect(
      (await faroDutchAuctionOwnerSigner.auctionState()).toString()
    ).to.equal(AUCTION_DEPLOYED_STATE);
    const mintFractionalTransaction =
      await this.ownerWithOffering.extendToFaroDutchAuction(
        faroDutchAuction,
        SUPPLY
      );
    await mintFractionalTransaction.wait();
    expect(
      (
        await this.ownerWithOffering.getFractionalBalance(faroDutchAuction)
      ).toString()
    ).to.equal(SUPPLY.toString());
  });

  it("Num of live auctions is 0 before start", async function () {
    expect(
      (
        await this.faroDutchAuctionFactoryWithNonOwnerSigner.getLiveAuctions(
          0,
          1
        )
      ).length
    ).to.equal(0);
  });

  it("Auction cannot be started by non-owner", async function () {
    const auction =
      await this.faroDutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const FaroDutchAuction = await ethers.getContractFactory(
      "FaroDutchAuction"
    );
    const faroDutchAuctionObject = await FaroDutchAuction.attach(auction);
    const faroDutchAuctionNonOwnerSigner = faroDutchAuctionObject.connect(
      this.nonOwnerSigner
    );
    await expectRevert(
      faroDutchAuctionNonOwnerSigner.start(),
      "This method can only be called by owner"
    );
  });

  it("Auction can be started by owner", async function () {
    const auction =
      await this.faroDutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const FaroDutchAuction = await ethers.getContractFactory(
      "FaroDutchAuction"
    );
    const faroDutchAuctionObject = await FaroDutchAuction.attach(auction);
    const faroDutchAuctionOwnerSigner = faroDutchAuctionObject.connect(
      this.projectFundRaisingSigner
    );
    const startTx = await faroDutchAuctionOwnerSigner.start();
    await startTx.wait();
    expect(
      (await faroDutchAuctionOwnerSigner.auctionState()).toString()
    ).to.equal(AUCTION_STARTED_STATE);
    expect(
      (await faroDutchAuctionOwnerSigner.auctionCurrentPrice()).toString()
    ).to.equal(this.startPrice.toString());
  });

  it("Num of live auctions is 1 after start", async function () {
    expect(
      (
        await this.faroDutchAuctionFactoryWithNonOwnerSigner.getLiveAuctions(
          0,
          1
        )
      ).length
    ).to.equal(1);
  });

  it("Owner cannot bid", async function () {
    const auction =
      await this.faroDutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const FaroDutchAuction = await ethers.getContractFactory(
      "FaroDutchAuction"
    );
    const faroDutchAuctionObject = await FaroDutchAuction.attach(auction);
    const faroDutchAuctionOwnerSigner = faroDutchAuctionObject.connect(
      this.projectFundRaisingSigner
    );
    const currentPrice =
      await faroDutchAuctionOwnerSigner.auctionCurrentPrice();
    await expectRevert(
      faroDutchAuctionOwnerSigner.bid(BUY_AMOUNT, {
        value: currentPrice,
      }),
      "Owner is not allowed to bid"
    );
  });

  it("Non-eligible cannot bid ", async function () {
    const auction =
      await this.faroDutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const FaroDutchAuction = await ethers.getContractFactory(
      "FaroDutchAuction"
    );
    const faroDutchAuctionObject = await FaroDutchAuction.attach(auction);
    const faroDutchAuctionNonOwnerSigner = faroDutchAuctionObject.connect(
      this.nonOwnerSigner
    );
    const currentPriceInWei =
      await faroDutchAuctionNonOwnerSigner.auctionCurrentPrice();
    const currentPriceInEth = ethers.utils.formatEther(currentPriceInWei);
    await expectRevert(
      faroDutchAuctionNonOwnerSigner.bid(BUY_AMOUNT, {
        value: ethers.utils.parseEther(currentPriceInEth.toString()),
      }),
      "Bidder is not eligible."
    );
  });

  it("Non-eligible cannot bid under current price", async function () {
    const auction =
      await this.faroDutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const FaroDutchAuction = await ethers.getContractFactory(
      "FaroDutchAuction"
    );
    const faroDutchAuctionObject = await FaroDutchAuction.attach(auction);
    const faroDutchAuctionNonOwnerSigner = faroDutchAuctionObject.connect(
      this.offeringParticipants[1]
    );
    const currentPriceInWei =
      await faroDutchAuctionNonOwnerSigner.auctionCurrentPrice();
    const currentPriceInEth = ethers.utils.formatEther(currentPriceInWei);
    await expectRevert(
      faroDutchAuctionNonOwnerSigner.bid(BUY_AMOUNT, {
        value: ethers.utils.parseEther(
          (currentPriceInEth - PRICE_DECREMENT).toString()
        ),
      }),
      "Bid value is less than current price."
    );
  });

  it("Non-owner can bid", async function () {
    const auction =
      await this.faroDutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const FaroDutchAuction = await ethers.getContractFactory(
      "FaroDutchAuction"
    );
    const faroDutchAuctionObject = await FaroDutchAuction.attach(auction);
    const faroDutchAuctionNonOwnerSigner = faroDutchAuctionObject.connect(
      this.offeringParticipants[1]
    );

    const projectFundingAddress =
      await faroDutchAuctionNonOwnerSigner.projectFundingAddress();
    const previousBalanceInWei = await ethers.provider.getBalance(
      projectFundingAddress
    );
    const previousBalance = ethers.utils.formatEther(previousBalanceInWei);
    const currentPriceInWei =
      await faroDutchAuctionNonOwnerSigner.auctionCurrentPrice();
    const currentPriceInEthers = ethers.utils.formatEther(currentPriceInWei);
    const paidMoney = currentPriceInEthers * BUY_AMOUNT;
    const bidTx = await faroDutchAuctionNonOwnerSigner.bid(BUY_AMOUNT, {
      value: ethers.utils.parseEther(paidMoney.toString()),
    });
    await bidTx.wait();
    const afterTxBalance = await ethers.provider.getBalance(
      projectFundingAddress
    );
    const afterTxBalanceInEth = ethers.utils.formatEther(afterTxBalance);
    expect(afterTxBalanceInEth - previousBalance).to.equal(paidMoney);
    expect(
      (
        await faroDutchAuctionNonOwnerSigner.getFractionalBalance(
          this.funderAddresses[1]
        )
      ).toString()
    ).to.equal(BUY_AMOUNT.toString());
    expect(
      (await faroDutchAuctionNonOwnerSigner.remaining()).toString()
    ).to.equal((SUPPLY - BUY_AMOUNT).toString());
  });

  it("Can buy again", async function () {
    const auction =
      await this.faroDutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const FaroDutchAuction = await ethers.getContractFactory(
      "FaroDutchAuction"
    );
    const faroDutchAuctionObject = await FaroDutchAuction.attach(auction);
    const faroDutchAuctionNonOwnerSigner = faroDutchAuctionObject.connect(
      this.offeringParticipants[1]
    );
    const projectFundingAddress =
      await faroDutchAuctionNonOwnerSigner.projectFundingAddress();
    const previousBalanceInWei = await ethers.provider.getBalance(
      projectFundingAddress
    );
    const previousBalance = ethers.utils.formatEther(previousBalanceInWei);
    const currentPriceInWei =
      await faroDutchAuctionNonOwnerSigner.auctionCurrentPrice();
    const currentPriceInEth = ethers.utils.formatEther(currentPriceInWei);
    const paidMoney = currentPriceInEth * BUY_AMOUNT;
    const bidTx = await faroDutchAuctionNonOwnerSigner.bid(BUY_AMOUNT, {
      value: ethers.utils.parseEther(paidMoney.toString()),
    });
    await bidTx.wait();
    const afterTxBalance = await ethers.provider.getBalance(
      projectFundingAddress
    );
    const afterTxBalanceInEth = ethers.utils.formatEther(afterTxBalance);
    expect(afterTxBalanceInEth - previousBalance).to.equal(paidMoney);

    const twiceBuyAmount = 2 * BUY_AMOUNT;
    expect(
      (
        await faroDutchAuctionNonOwnerSigner.getFractionalBalance(
          this.funderAddresses[1]
        )
      ).toString()
    ).to.equal(twiceBuyAmount.toString());
    expect(
      (await faroDutchAuctionNonOwnerSigner.remaining()).toString()
    ).to.equal((SUPPLY - twiceBuyAmount).toString());
  });

  it("Another user can buy ", async function () {
    const auction =
      await this.faroDutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const FaroDutchAuction = await ethers.getContractFactory(
      "FaroDutchAuction"
    );
    const faroDutchAuctionObject = await FaroDutchAuction.attach(auction);
    const faroDutchAuctionNonOwnerSigner = faroDutchAuctionObject.connect(
      this.offeringParticipants[2]
    );
    const projectFundingAddress =
      await faroDutchAuctionNonOwnerSigner.projectFundingAddress();
    const previousBalance = ethers.utils.formatEther(
      await ethers.provider.getBalance(projectFundingAddress)
    );
    const currentPriceInEth = ethers.utils.formatEther(
      await faroDutchAuctionNonOwnerSigner.auctionCurrentPrice()
    );
    const paidMoney = currentPriceInEth * BUY_AMOUNT;
    const bidTx = await faroDutchAuctionNonOwnerSigner.bid(BUY_AMOUNT, {
      value: ethers.utils.parseEther(paidMoney.toString()),
    });
    await bidTx.wait();
    const afterTxBalance = await ethers.provider.getBalance(
      projectFundingAddress
    );
    const afterTxBalanceInEth = ethers.utils.formatEther(afterTxBalance);
    expect(afterTxBalanceInEth - previousBalance).to.equal(paidMoney);
    const tripleBuyAmount = 3 * BUY_AMOUNT;
    expect(
      (
        await faroDutchAuctionNonOwnerSigner.getFractionalBalance(
          this.funderAddresses[2]
        )
      ).toString()
    ).to.equal(BUY_AMOUNT.toString());
    expect(
      (await faroDutchAuctionNonOwnerSigner.remaining()).toString()
    ).to.equal((SUPPLY - tripleBuyAmount).toString());
  });

  it("Price changes over time ", async function () {
    await timeMachine.advanceTimeAndBlock(
      ethers.provider,
      FAST_FORWARD_PERIOD1 * SECS_IN_DAY
    );
    const auction =
      await this.faroDutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const FaroDutchAuction = await ethers.getContractFactory(
      "FaroDutchAuction"
    );
    const faroDutchAuctionObject = await FaroDutchAuction.attach(auction);
    const faroDutchAuctionNonOwnerSigner = faroDutchAuctionObject.connect(
      this.nonOwnerSigner2
    );
    const priceTx = await faroDutchAuctionNonOwnerSigner.setCurrentPrice();
    await priceTx.wait();
    expect(
      (await faroDutchAuctionNonOwnerSigner.auctionCurrentPrice()).toString()
    ).to.equal(this.ethPriceChanges[FAST_FORWARD_PERIOD1].toString());
  });

  it("Can bid with new price", async function () {
    const auction =
      await this.faroDutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const FaroDutchAuction = await ethers.getContractFactory(
      "FaroDutchAuction"
    );
    const faroDutchAuctionObject = await FaroDutchAuction.attach(auction);
    const faroDutchAuctionNonOwnerSigner = faroDutchAuctionObject.connect(
      this.offeringParticipants[2]
    );
    const projectFundingAddress =
      await faroDutchAuctionNonOwnerSigner.projectFundingAddress();
    const previousBalance = ethers.utils.formatEther(
      await ethers.provider.getBalance(projectFundingAddress)
    );
    const currentPriceInEth = ethers.utils.formatEther(
      await faroDutchAuctionNonOwnerSigner.auctionCurrentPrice()
    );
    const paidMoney = currentPriceInEth * BUY_AMOUNT;
    const bidTx = await faroDutchAuctionNonOwnerSigner.bid(BUY_AMOUNT, {
      value: ethers.utils.parseEther(paidMoney.toString()),
    });
    await bidTx.wait();
    const afterTxBalance = await ethers.provider.getBalance(
      projectFundingAddress
    );
    const afterTxBalanceInEth = ethers.utils.formatEther(afterTxBalance);
    expect(afterTxBalanceInEth - previousBalance - paidMoney).lessThan(
      Math.pow(10, -7)
    );
    const twiceBuyAmount = 2 * BUY_AMOUNT;

    expect(
      (
        await faroDutchAuctionNonOwnerSigner.getFractionalBalance(
          this.funderAddresses[2]
        )
      ).toString()
    ).to.equal(twiceBuyAmount.toString());
    expect(
      (await faroDutchAuctionNonOwnerSigner.remaining()).toString()
    ).to.equal((SUPPLY - 2 * twiceBuyAmount).toString());
  });

  it("Cannot buy with less than that but can with higher", async function () {
    const auction =
      await this.faroDutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const FaroDutchAuction = await ethers.getContractFactory(
      "FaroDutchAuction"
    );
    const faroDutchAuctionObject = await FaroDutchAuction.attach(auction);
    const faroDutchAuctionNonOwnerSigner = faroDutchAuctionObject.connect(
      this.offeringParticipants[2]
    );
    const projectFundingAddress =
      await faroDutchAuctionNonOwnerSigner.projectFundingAddress();
    const previousBalance = ethers.utils.formatEther(
      await ethers.provider.getBalance(projectFundingAddress)
    );
    const currentPrice = ethers.utils.formatEther(
      await faroDutchAuctionNonOwnerSigner.auctionCurrentPrice()
    );
    await expectRevert(
      faroDutchAuctionNonOwnerSigner.bid(BUY_AMOUNT, {
        value: ethers.utils.parseEther(
          (currentPrice - PRICE_DECREMENT).toString()
        ),
      }),
      "Bid value is less than current price."
    );
    const paidMoney = currentPrice * 3 * BUY_AMOUNT;

    const bidTx = await faroDutchAuctionNonOwnerSigner.bid(BUY_AMOUNT, {
      value: ethers.utils.parseEther(paidMoney.toString()),
    });
    await bidTx.wait();
    const afterTxBalance = await ethers.provider.getBalance(
      projectFundingAddress
    );
    const afterTxBalanceInEth = ethers.utils.formatEther(afterTxBalance);
    expect(afterTxBalanceInEth - previousBalance - paidMoney).lessThan(
      Math.pow(10, -7)
    );
    const tripleBuyAmount = 3 * BUY_AMOUNT;
    expect(
      (
        await faroDutchAuctionNonOwnerSigner.getFractionalBalance(
          this.funderAddresses[2]
        )
      ).toString()
    ).to.equal(tripleBuyAmount.toString());
    expect(
      (await faroDutchAuctionNonOwnerSigner.remaining()).toString()
    ).to.equal((SUPPLY - 5 * BUY_AMOUNT).toString());
  });

  it("Price changes over time again", async function () {
    await timeMachine.advanceTimeAndBlock(
      ethers.provider,
      FAST_FORWARD_PERIOD2 * SECS_IN_DAY
    );
    const auction =
      await this.faroDutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const FaroDutchAuction = await ethers.getContractFactory(
      "FaroDutchAuction"
    );
    const faroDutchAuctionObject = await FaroDutchAuction.attach(auction);
    const faroDutchAuctionNonOwnerSigner = faroDutchAuctionObject.connect(
      this.nonOwnerSigner2
    );
    const setPriceTx = await faroDutchAuctionNonOwnerSigner.setCurrentPrice();
    await setPriceTx.wait();
    expect(
      (await faroDutchAuctionNonOwnerSigner.auctionCurrentPrice()).toString()
    ).to.equal(
      this.ethPriceChanges[
        FAST_FORWARD_PERIOD1 + FAST_FORWARD_PERIOD2
      ].toString()
    );
  });

  it("Cannot buy with less than that but can with higher again", async function () {
    const auction =
      await this.faroDutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const FaroDutchAuction = await ethers.getContractFactory(
      "FaroDutchAuction"
    );
    const faroDutchAuctionObject = await FaroDutchAuction.attach(auction);
    const faroDutchAuctionNonOwnerSigner = faroDutchAuctionObject.connect(
      this.offeringParticipants[2]
    );
    const projectFundingAddress =
      await faroDutchAuctionNonOwnerSigner.projectFundingAddress();
    const previousBalance = ethers.utils.formatEther(
      await ethers.provider.getBalance(projectFundingAddress)
    );
    const currentPrice = ethers.utils.formatEther(
      await faroDutchAuctionNonOwnerSigner.auctionCurrentPrice()
    );
    await expectRevert(
      faroDutchAuctionNonOwnerSigner.bid(BUY_AMOUNT, {
        value: ethers.utils.parseEther(
          (currentPrice - PRICE_DECREMENT).toString()
        ),
      }),
      "Bid value is less than current price."
    );
    const paidMoney = currentPrice * 4 * BUY_AMOUNT;
    const bidTx = await faroDutchAuctionNonOwnerSigner.bid(BUY_AMOUNT, {
      value: ethers.utils.parseEther(paidMoney.toString()),
    });
    await bidTx.wait();
    const afterTxBalance = await ethers.provider.getBalance(
      projectFundingAddress
    );
    const afterTxBalanceInEth = ethers.utils.formatEther(afterTxBalance);
    expect(afterTxBalanceInEth - previousBalance - paidMoney).lessThan(
      Math.pow(10, -7)
    );
    const quadrupleBuyAmount = 4 * BUY_AMOUNT;
    expect(
      (
        await faroDutchAuctionNonOwnerSigner.getFractionalBalance(
          this.funderAddresses[2]
        )
      ).toString()
    ).to.equal(quadrupleBuyAmount.toString());
    expect(
      (await faroDutchAuctionNonOwnerSigner.remaining()).toString()
    ).to.equal((SUPPLY - 6 * BUY_AMOUNT).toString());
  });

  it("Price reaches offering price, the auction ends automatically", async function () {
    await timeMachine.advanceTimeAndBlock(
      ethers.provider,
      FAST_FORWARD_PERIOD3 * SECS_IN_DAY
    );
    const auction =
      await this.faroDutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const FaroDutchAuction = await ethers.getContractFactory(
      "FaroDutchAuction"
    );
    const faroDutchAuctionObject = await FaroDutchAuction.attach(auction);
    const faroDutchAuctionNonOwnerSigner = faroDutchAuctionObject.connect(
      this.nonOwnerSigner2
    );
    const setPriceTx = await faroDutchAuctionNonOwnerSigner.setCurrentPrice();
    await setPriceTx.wait();
    expect(
      (await faroDutchAuctionNonOwnerSigner.auctionCurrentPrice()).toString()
    ).to.equal(
      this.ethPriceChanges[
        FAST_FORWARD_PERIOD1 + FAST_FORWARD_PERIOD2 + FAST_FORWARD_PERIOD3
      ].toString()
    );
    expect(await faroDutchAuctionNonOwnerSigner.timeTick()).to.equal(
      this.ethPriceChanges.length - 1
    );
    expect(
      (await faroDutchAuctionNonOwnerSigner.auctionState()).toString()
    ).to.equal(AUCTION_ENDED_STATE);
  });

  it("Cannot bid on ended auction ", async function () {
    const auction =
      await this.faroDutchAuctionFactoryWithNonOwnerSigner.getLastAuction();
    const FaroDutchAuction = await ethers.getContractFactory(
      "FaroDutchAuction"
    );
    const faroDutchAuctionObject = await FaroDutchAuction.attach(auction);
    const faroDutchAuctionNonOwnerSigner = faroDutchAuctionObject.connect(
      this.offeringParticipants[2]
    );
    const currentPriceInEth = ethers.utils.formatEther(
      await faroDutchAuctionNonOwnerSigner.auctionCurrentPrice()
    );
    const paidMoney = currentPriceInEth * BUY_AMOUNT;
    await expectRevert(
      faroDutchAuctionNonOwnerSigner.bid(BUY_AMOUNT, {
        value: ethers.utils.parseEther(paidMoney.toString()),
      }),
      "Auction is not live."
    );
  });

  it("Num of live auctions is 0 after end", async function () {
    expect(
      (
        await this.faroDutchAuctionFactoryWithNonOwnerSigner.getLiveAuctions(
          0,
          1
        )
      ).length
    ).to.equal(0);
  });
});
