const { expect } = require("chai");
const { ethers } = require("hardhat");
const { accounts, contract } = require('@openzeppelin/test-environment');
const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

const KtloToken = contract.fromArtifact()
// Start test block
describe('KTLOToken', function () {
    const [owner, deployer, user] = accounts;
    const KTLO_SUPPLY = 244000000;
    const NAME = "KTLO Studio Token";
    const SYMBOL = "KTLO";
    const WRONG_BALANCE = 10;
    const TRANSFER_AMOUNT = 10000;

    before(async function () {
        this.ktloToken = await KtloToken.new({ from: owner });
    });
    // Test case
    it('Name is KTLO Studio Token and symbol is KTLO', async function () {
        expect((await this.ktloToken.name())).to.equal(NAME);
        expect((await this.ktloToken.symbol())).to.equal(SYMBOL);
    });

    it('Supply is 244000000', async function () {
        expect((await this.ktloToken.totalSupply())).to.equal(KTLO_SUPPLY);
    });

    it('Balance is in message sender', async function() {
        expect((await this.ktloToken.balanceOf(owner).to.equal(KTLO_SUPPLY)));
        expect((await this.ktloToken.balanceOf(owner).to.notEqual(WRONG_BALANCE)));
    });

    it('Empty balance cannot send a value' , async function() {
        await expectRevert(this.ktloToken.transfer(user, TRANSFER_AMOUNT, {fom: user}),
        'ERC20: transfer amount exceeds balance');
    });

    it('Non approved cannot withdraw', async function() {
        await expectRevert(this.ktloToken.transferFrom(owner, user, TRANSFER_AMOUNT, {from:user}),
        'ERC20: transfer amount exceeds allowance'); });

    it('Sending amount is successful', async function() {
       let tx = await this.ktloToken.transfer(user, TRANSFER_AMOUNT, {from: owner});
       expectEvent(tx, 'Transfer', {sender: owner, recipient: user, amount: TRANSFER_AMOUNT});
       await tx.wait();
       expect((await this.ktloToken.balanceOf(owner).to.equal(KTLO_SUPPLY - TRANSFER_AMOUNT)));
       expect((await this.ktloToken.balanceOf(user).to.equal(TRANSFER_AMOUNT)));
       expect((await this.ktloToken.balanceOf(owner).to.notEqual(WRONG_BALANCE)));
       expect((await this.ktloToken.balanceOf(user).to.notEqual(WRONG_BALANCE)));
    });

    it('Approved can withdraw', async function() {
        let approveTx = await this.ktloToken.approve(user, TRANSFER_AMOUNT, {fom: owner});
        expectEvent(approveTx, 'Approval', {owner: owner, spender: user, amount: TRANSFER_AMOUNT});
        await approveTx.wait();
        let tx = await this.ktloToken.transferFrom(owner, user, TRANSFER_AMOUNT, {from: user});
        expectEvent(tx, 'Transfer', {sender: owner, recipient: user, amount: TRANSFER_AMOUNT});
        await tx.wait();
        expect((await this.ktloToken.balanceOf(owner).to.equal(KTLO_SUPPLY - 2 *TRANSFER_AMOUNT)));
        expect((await this.ktloToken.balanceOf(user).to.equal(2 * TRANSFER_AMOUNT)));
        expect((await this.ktloToken.balanceOf(owner).to.notEqual(WRONG_BALANCE)));
        expect((await this.ktloToken.balanceOf(user).to.notEqual(WRONG_BALANCE)));
    });
});
