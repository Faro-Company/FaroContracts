const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BN, expectRevert } = require("@openzeppelin/test-helpers");

const FARO_SUPPLY = new BN("2440000000000000000000000000");
const NAME = "Faro Studio Token";
const SYMBOL = "FARO";
const WRONG_BALANCE = new BN("10");
const TRANSFER_AMOUNT = new BN("10000000000");
const DOUBLE_TRANSFER_AMOUNT = new BN("20000000000");
const CHANGE = new BN("2439999999999999990000000000");
const CHANGE_AFTER_SEND_TWICE = new BN("2439999999999999980000000000");

// Start test block
describe("FaroToken", function () {
  before(async function () {
    const accounts = await ethers.provider.listAccounts();
    this.owner = accounts[0];
    this.user = accounts[2];
    this.user2 = accounts[3];
    this.userSigner = await ethers.getSigner(this.user);
    this.ownerSigner = await ethers.getSigner(this.owner);
    const FaroToken = await ethers.getContractFactory("FaroToken");
    this.faroToken = await FaroToken.deploy();
  });
  // Test case
  it("Name is FARO Studio Token and symbol is FARO", async function () {
    expect(await this.faroToken.name()).to.equal(NAME);
    expect(await this.faroToken.symbol()).to.equal(SYMBOL);
  });

  it("Supply is 2440000000000000000000000000", async function () {
    expect((await this.faroToken.totalSupply()).toString()).equal(
      FARO_SUPPLY.toString()
    );
  });

  it("Balance is in message sender", async function () {
    expect((await this.faroToken.balanceOf(this.owner)).toString()).to.equal(
      FARO_SUPPLY.toString()
    );
    expect(
      (await this.faroToken.balanceOf(this.owner)).toString()
    ).to.not.equal(WRONG_BALANCE.toString());
  });

  it("Empty balance cannot send a value", async function () {
    this.faroToken.connect(this.userSigner);
    await expectRevert(
      this.faroToken.transferFrom(
        this.user,
        this.user2,
        TRANSFER_AMOUNT.toNumber()
      ),
      "ERC20: transfer amount exceeds balance"
    );
  });

  it("Non approved cannot withdraw", async function () {
    this.faroToken.connect(this.userSigner);
    await expectRevert(
      this.faroToken.transferFrom(
        this.owner,
        this.user,
        TRANSFER_AMOUNT.toNumber()
      ),
      "ERC20: transfer amount exceeds allowance"
    );
  });

  it("Sending amount is successful", async function () {
    this.faroToken.connect(this.ownerSigner);
    const approveTx = await this.faroToken.approve(
      this.owner,
      DOUBLE_TRANSFER_AMOUNT.toNumber()
    );
    await approveTx.wait();
    this.tx = await this.faroToken.transferFrom(
      this.owner,
      this.user,
      TRANSFER_AMOUNT.toNumber()
    );
    await this.tx.wait();
    expect((await this.faroToken.balanceOf(this.owner)).toString()).to.equal(
      CHANGE.toString()
    );
    expect((await this.faroToken.balanceOf(this.user)).toString()).to.equal(
      TRANSFER_AMOUNT.toString()
    );
    expect(
      (await this.faroToken.balanceOf(this.owner)).toString()
    ).to.not.equal(WRONG_BALANCE.toString());
    expect((await this.faroToken.balanceOf(this.user)).toString()).to.not.equal(
      WRONG_BALANCE.toString()
    );
  });

  it("Approved can withdraw", async function () {
    this.faroToken.connect(this.ownerSigner);
    const approveTx = await this.faroToken.approve(
      this.user,
      TRANSFER_AMOUNT.toNumber()
    );
    await approveTx.wait();
    this.faroToken.connect(this.userSigner);
    const tx = await this.faroToken.transferFrom(
      this.owner,
      this.user,
      TRANSFER_AMOUNT.toNumber()
    );
    await tx.wait();
    expect((await this.faroToken.balanceOf(this.owner)).toString()).to.equal(
      CHANGE_AFTER_SEND_TWICE.toString()
    );
    expect((await this.faroToken.balanceOf(this.user)).toString()).to.equal(
      DOUBLE_TRANSFER_AMOUNT.toString()
    );
    expect(
      (await this.faroToken.balanceOf(this.owner)).toString()
    ).to.not.equal(WRONG_BALANCE.toString());
    expect((await this.faroToken.balanceOf(this.user)).toString()).to.not.equal(
      WRONG_BALANCE.toString()
    );
  });
});
