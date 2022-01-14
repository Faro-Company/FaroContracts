const { expect } = require("chai");
const { ethers } = require("hardhat");
const { expectRevert } = require("@openzeppelin/test-helpers");

const NAME = "FARO Journey Starting";
const SYMBOL = "FAROM";
const TOKEN_URI = "HERE";
const LIST_PRICE = 5;
const LIST_PRICE_AS_ETH = ethers.utils.parseEther("5");
const LISTING_PERIOD = 30;

const ACCOUNTS_NUM = 20;
const PARTICIPANTS_NUM = 17;
const BUY_AMOUNT = 10;

describe("FaroOffering", function () {
  before(async function () {
    await ethers.provider.send("hardhat_reset");
    const accounts = await ethers.provider.listAccounts();
    this.owner = accounts[0];
    this.user = accounts[1];
    this.user2 = accounts[2];
    this.ownerSigner = await ethers.getSigner(this.owner);
    this.projectFundRaisingSigner = await ethers.getSigner(this.user);
    this.distributor = await ethers.getSigner(this.user2);

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
    const ERCVaultFactory = await ethers.getContractFactory(
      "FaroOfferingFactory"
    );
    this.ercVaultFactory = await ERCVaultFactory.deploy();
    await this.ercVaultFactory.deployed();
    const tokenVaultFactoryAddress = this.ercVaultFactory.address;

    const FarownershipToken = await ethers.getContractFactory("Farownership");
    const ownershipAddresses = [];

    for (let i = 0; i < 2; i++) {
      this.farownershipToken = await FarownershipToken.deploy(
        NAME,
        SYMBOL,
        TOKEN_URI
      );
      await this.farownershipToken.deployed();
      ownershipAddresses.push(this.farownershipToken.address);
      const erc721ContractWithSigner = this.farownershipToken.connect(
        this.ownerSigner
      );
      const mintTx = await erc721ContractWithSigner.mint(this.user);
      await mintTx.wait();

      const erc721RecipientSigner = this.farownershipToken.connect(
        this.projectFundRaisingSigner
      );
      const approveTx = await erc721RecipientSigner.approve(
        tokenVaultFactoryAddress,
        1
      );
      await approveTx.wait();
    }

    this.factoryWithSigner = this.ercVaultFactory.connect(this.ownerSigner);
    let tx;
    for (let i = 0; i < 2; i++) {
      tx = await this.factoryWithSigner.mint(
        ownershipAddresses[i],
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
    }
    this.offeringAddress = await this.factoryWithSigner.getOffering(0);
    this.OfferingVault = await ethers.getContractFactory("FaroOffering");
    this.offeringVault = await this.OfferingVault.attach(this.offeringAddress);
    this.ownerWithOffering = this.offeringVault.connect(
      this.projectFundRaisingSigner
    );
    this.nonownerWithOffering = this.offeringVault.connect(this.distributor);
    this.participantSigner = this.offeringVault.connect(
      this.offeringParticipants[0]
    );
  });

  it("The number of live offerings is 0 before start", async function () {
    expect(
      (await this.factoryWithSigner.getLiveOfferings(0, 2)).length
    ).to.equal(0);
  });

  it("Cannot be started by non-owner", async function () {
    await expectRevert(
      this.nonownerWithOffering.start(),
      "Sender is not the project owner."
    );
  });

  it("Cannot make a bid on not started offering", async function () {
    await expectRevert(
      this.participantSigner.bid(Math.floor(this.fairAlloc / 2)),
      "Offering is not live"
    );
  });

  it("Can be started by the owner", async function () {
    const startTx = await this.ownerWithOffering.start();
    await startTx.wait();
    expect(await this.ownerWithOffering.offeringState()).to.equal(1);
  });

  it("The number of live offerings is 1 after start ", async function () {
    expect(
      (await this.factoryWithSigner.getLiveOfferings(0, 2)).length
    ).to.equal(1);
  });

  it("Cannot bid if not among funders", async function () {
    await expectRevert(
      this.nonownerWithOffering.bid(Math.floor(this.fairAlloc / 2), {
        value: ethers.utils.parseEther(
          Math.floor((this.fairAlloc * LIST_PRICE) / 2).toString()
        ),
      }),
      "Address is not allowed to participate in the offering."
    );
  });

  it("Cannot bid more than allocation", async function () {
    await expectRevert(
      this.participantSigner.bid(this.fairAlloc * 2, {
        value: ethers.utils.parseEther(
          Math.floor(this.fairAlloc * 2 * LIST_PRICE).toString()
        ),
      }),
      "Bid is more than allocated for this address."
    );
  });

  it("Cannot buy more by paying cheaper", async function () {
    await expectRevert(
      this.participantSigner.bid(Math.floor(this.fairAlloc / 2), {
        value: ethers.utils.parseEther(
          Math.floor((this.fairAlloc * LIST_PRICE) / 3).toString()
        ),
      }),
      "Funds sent for bid is less than the total capital required to buy the amount."
    );
  });

  it("Cannot make a bid with 0 amount", async function () {
    await expectRevert(
      this.participantSigner.bid(0, {
        value: ethers.utils.parseEther(
          Math.floor((this.fairAlloc * LIST_PRICE) / 3).toString()
        ),
      }),
      "Bid amount cannot be zero."
    );
  });

  it("Cannot make a bid by paying 0", async function () {
    await expectRevert(
      this.participantSigner.bid(Math.floor(this.fairAlloc / 2), {
        value: ethers.utils.parseEther("0"),
      }),
      "Funds sent cannot be zero."
    );
  });

  it("Can make a legit bid", async function () {
    const participantAddress = this.offeringParticipants[0].address;
    const fundsToSend = ethers.utils.parseEther(
      (BUY_AMOUNT * LIST_PRICE).toString()
    );
    const balance = await ethers.provider.getBalance(participantAddress);
    const gas = await this.participantSigner.estimateGas.bid(BUY_AMOUNT, {
      value: fundsToSend,
    });
    const tx = await this.participantSigner.bid(BUY_AMOUNT, {
      value: fundsToSend,
    });
    await tx.wait();
    expect(
      (
        await this.participantSigner.getRemainingAllocation(participantAddress)
      ).toString()
    ).to.equal((this.fairAlloc - BUY_AMOUNT).toString());
    expect(
      (
        await this.participantSigner.getFractionalBalance(participantAddress)
      ).toString()
    ).to.equal(BUY_AMOUNT.toString());
    expect(
      (await ethers.provider.getBalance(participantAddress)) -
        (balance - fundsToSend - gas)
    ).lessThan(Math.pow(10, 9));
  });

  it("Can make a legit bid again without finishing the allocation", async function () {
    const participantAddress = this.offeringParticipants[0].address;
    const fundsToSend = ethers.utils.parseEther(
      (BUY_AMOUNT * LIST_PRICE).toString()
    );
    const gas = await this.participantSigner.estimateGas.bid(BUY_AMOUNT, {
      value: fundsToSend,
    });
    const TOTAL_AMOUNT_TO_BE_BOUGHT = 2 * BUY_AMOUNT;
    const balance = await ethers.provider.getBalance(participantAddress);
    const tx = await this.participantSigner.bid(BUY_AMOUNT, {
      value: fundsToSend,
    });
    await tx.wait();
    expect(
      (
        await this.participantSigner.getRemainingAllocation(participantAddress)
      ).toString()
    ).to.equal((this.fairAlloc - TOTAL_AMOUNT_TO_BE_BOUGHT).toString());
    expect(
      (
        await this.participantSigner.getFractionalBalance(participantAddress)
      ).toString()
    ).to.equal(TOTAL_AMOUNT_TO_BE_BOUGHT.toString());
    expect(
      (await ethers.provider.getBalance(participantAddress)) -
        (balance - fundsToSend - gas)
    ).lessThan(Math.pow(10, 9));
  });

  it("Cant buy more than allocated after successful bids", async function () {
    const remainingAllocation = parseInt(
      (
        await this.participantSigner.getRemainingAllocation(
          this.offeringParticipants[0].address
        )
      ).toString()
    );
    const bidAmount = remainingAllocation + BUY_AMOUNT;
    const fundsToSend = ethers.utils.parseEther(
      (bidAmount * LIST_PRICE).toString()
    );
    await expectRevert(
      this.participantSigner.bid(bidAmount, {
        value: fundsToSend,
      }),
      "Bid is more than allocated for this address."
    );
  });

  it("Non-owner cannot pause", async function () {
    await expectRevert(
      this.participantSigner.pause(),
      "Sender is not the project owner."
    );
  });

  it("Owner can pause", async function () {
    const tx = await this.ownerWithOffering.pause();
    await tx.wait();
    expect(await this.participantSigner.paused()).to.equal(true);
  });

  it("The number of live offerings is 0 when paused", async function () {
    expect(
      (await this.factoryWithSigner.getLiveOfferings(0, 2)).length
    ).to.equal(0);
  });

  it("Cant buy when paused", async function () {
    const fundsToSend = ethers.utils.parseEther(
      (BUY_AMOUNT * LIST_PRICE).toString()
    );
    await expectRevert(
      this.participantSigner.bid(BUY_AMOUNT, {
        value: fundsToSend,
      }),
      "The bid is paused."
    );
  });

  it("Non-owner cannot unpause when paused", async function () {
    await expectRevert(
      this.participantSigner.unpause(),
      "Sender is not the project owner."
    );
  });

  it("Owner can unpause", async function () {
    const tx = await this.ownerWithOffering.unpause();
    await tx.wait();
    expect(await this.participantSigner.paused()).to.equal(false);
  });

  it("The number of live offerings is back to 1 when unpaused", async function () {
    expect(
      (await this.factoryWithSigner.getLiveOfferings(0, 2)).length
    ).to.equal(1);
  });

  it("Bidding finishes when allocations are all bought", async function () {
    let amountToBid,
      participant,
      participantSigner,
      tx,
      fundsToSend,
      participantAddress,
      gas;
    for (let i = 0; i < this.offeringParticipants.length; i++) {
      participant = this.offeringParticipants[i];
      participantSigner = this.offeringVault.connect(participant);
      participantAddress = participant.address;
      amountToBid = parseInt(
        (
          await participantSigner.getRemainingAllocation(participantAddress)
        ).toString()
      );
      fundsToSend = ethers.utils.parseEther(
        (amountToBid * LIST_PRICE).toString()
      );
      gas = await participantSigner.estimateGas.bid(amountToBid, {
        value: fundsToSend,
      });
      const balance = await ethers.provider.getBalance(participantAddress);
      tx = await participantSigner.bid(amountToBid, { value: fundsToSend });
      await tx.wait();
      expect(
        (
          await participantSigner.getRemainingAllocation(participantAddress)
        ).toString()
      ).to.equal("0");
      expect(
        (
          await participantSigner.getFractionalBalance(participantAddress)
        ).toString()
      ).to.equal(this.fairAlloc.toString());
      expect(
        (await ethers.provider.getBalance(participantAddress)) -
          (balance - fundsToSend - gas)
      ).lessThan(Math.pow(10, 9));
    }
    expect((await participantSigner.offeringState()).toString()).to.equal("2");
  });

  it("Cannot bid on ended offering", async function () {
    await expectRevert(
      this.participantSigner.bid(BUY_AMOUNT),
      "Offering is not live."
    );
  });

  it("The number of live offerings is 0 after end", async function () {
    expect(
      (await this.factoryWithSigner.getLiveOfferings(0, 2)).length
    ).to.equal(0);
  });
});
