const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BN, expectRevert } = require("@openzeppelin/test-helpers");

const KTLO_SUPPLY = new BN("2440000000000000000000000000");
const NAME = "KTLO Studio Token";
const SYMBOL = "KTLO";
const WRONG_BALANCE = new BN("10");
const TRANSFER_AMOUNT = new BN("10000000000");
const DOUBLE_TRANSFER_AMOUNT = new BN("20000000000");
const CHANGE = new BN("2439999999999999990000000000");
const CHANGE_AFTER_SEND_TWICE = new BN("2439999999999999980000000000");

// Start test block
describe("KTLOToken", function () {
  before(async function () {
    const accounts = await ethers.provider.listAccounts();
    this.owner = accounts[0];
    this.user = accounts[2];
    this.user2 = accounts[3];
    this.userSigner = await ethers.getSigner(this.user);
    this.ownerSigner = await ethers.getSigner(this.owner);
    const KtloToken = await ethers.getContractFactory("KTLOToken");
    this.ktloToken = await KtloToken.deploy();
  });
  // Test case
  it("Name is KTLO Studio Token and symbol is KTLO", async function () {
    expect(await this.ktloToken.name()).to.equal(NAME);
    expect(await this.ktloToken.symbol()).to.equal(SYMBOL);
  });

  it("Supply is 2440000000000000000000000000", async function () {
    expect((await this.ktloToken.totalSupply()).toString()).equal(
      KTLO_SUPPLY.toString()
    );
  });

  it("Balance is in message sender", async function () {
    expect((await this.ktloToken.balanceOf(this.owner)).toString()).to.equal(
      KTLO_SUPPLY.toString()
    );
    expect(
      (await this.ktloToken.balanceOf(this.owner)).toString()
    ).to.not.equal(WRONG_BALANCE.toString());
  });

  it("Empty balance cannot send a value", async function () {
    this.ktloToken.connect(this.userSigner);
    await expectRevert(
      this.ktloToken.transferFrom(
        this.user,
        this.user2,
        TRANSFER_AMOUNT.toNumber()
      ),
      "ERC20: transfer amount exceeds balance"
    );
  });

  it("Non approved cannot withdraw", async function () {
    this.ktloToken.connect(this.userSigner);
    await expectRevert(
      this.ktloToken.transferFrom(
        this.owner,
        this.user,
        TRANSFER_AMOUNT.toNumber()
      ),
      "ERC20: transfer amount exceeds allowance"
    );
  });

  it("Sending amount is successful", async function () {
    this.ktloToken.connect(this.ownerSigner);
    const approveTx = await this.ktloToken.approve(
      this.owner,
      DOUBLE_TRANSFER_AMOUNT.toNumber()
    );
    await approveTx.wait();
    this.tx = await this.ktloToken.transferFrom(
      this.owner,
      this.user,
      TRANSFER_AMOUNT.toNumber()
    );
    await this.tx.wait();
    expect((await this.ktloToken.balanceOf(this.owner)).toString()).to.equal(
      CHANGE.toString()
    );
    expect((await this.ktloToken.balanceOf(this.user)).toString()).to.equal(
      TRANSFER_AMOUNT.toString()
    );
    expect(
      (await this.ktloToken.balanceOf(this.owner)).toString()
    ).to.not.equal(WRONG_BALANCE.toString());
    expect((await this.ktloToken.balanceOf(this.user)).toString()).to.not.equal(
      WRONG_BALANCE.toString()
    );
  });

  it("Approved can withdraw", async function () {
    this.ktloToken.connect(this.ownerSigner);
    const approveTx = await this.ktloToken.approve(
      this.user,
      TRANSFER_AMOUNT.toNumber()
    );
    await approveTx.wait();
    this.ktloToken.connect(this.userSigner);
    const tx = await this.ktloToken.transferFrom(
      this.owner,
      this.user,
      TRANSFER_AMOUNT.toNumber()
    );
    await tx.wait();
    expect((await this.ktloToken.balanceOf(this.owner)).toString()).to.equal(
      CHANGE_AFTER_SEND_TWICE.toString()
    );
    expect((await this.ktloToken.balanceOf(this.user)).toString()).to.equal(
      DOUBLE_TRANSFER_AMOUNT.toString()
    );
    expect(
      (await this.ktloToken.balanceOf(this.owner)).toString()
    ).to.not.equal(WRONG_BALANCE.toString());
    expect((await this.ktloToken.balanceOf(this.user)).toString()).to.not.equal(
      WRONG_BALANCE.toString()
    );
  });
});
