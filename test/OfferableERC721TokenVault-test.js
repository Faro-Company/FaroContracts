
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { expectRevert } = require('@openzeppelin/test-helpers');


const NAME = "KTLO Journey Starting";
const SYMBOL = "KTLOM";
const TOKEN_URI = "HERE";
const LIST_PRICE = 5;
const LISTING_PERIOD = 30;

const ACCOUNTS_NUM = 20;
const PARTICIPANTS_NUM = 17;
const DOLLAR_DISTRIBUTE_AMOUNT = 10000000000;
const BUY_AMOUNT = 500;


describe("OfferableERC721TokenVault", function () {

    before(async function () {
        const accounts = await ethers.provider.listAccounts();
        this.owner = accounts[0];
        this.user = accounts[1];
        this.user2 = accounts[2];
        this.ownerSigner = await ethers.getSigner(this.owner);
        this.projectFundRaisingSigner = await ethers.getSigner(this.user);
        this.distributor = await ethers.getSigner(this.user2);

        this.supply = 10000000;

        let distributeEtherTx;

        let participantWallet;
        let participantAddress;

        this.offeringParticipants = [];
        this.funderAddresses = [];
        this.allocations = [];

        const USDCMock = await ethers.getContractFactory('USDCMock');
        this.usdcMock = await USDCMock.deploy();
        await this.usdcMock.deployed();

        let usdcApproveTx = await this.usdcMock.approve(this.user2, DOLLAR_DISTRIBUTE_AMOUNT * PARTICIPANTS_NUM);
        await usdcApproveTx.wait();

        let usdcSigner = this.usdcMock.connect(this.distributor);
        let usdcTransferTx;

        this.fairAlloc = Math.floor(this.supply / PARTICIPANTS_NUM);

        for (let i = 3; i < ACCOUNTS_NUM; i++) {
            participantAddress = accounts[i];
            participantWallet = await ethers.getSigner(participantAddress);
            this.offeringParticipants.push(participantWallet);
            this.funderAddresses.push(participantAddress);
            this.allocations.push(this.fairAlloc);
            distributeEtherTx = this.distributor.sendTransaction({
                to: participantAddress,
                value: ethers.utils.parseEther("1")
            });
            usdcTransferTx = await usdcSigner.transferFrom(this.owner, participantAddress, DOLLAR_DISTRIBUTE_AMOUNT);
            await usdcTransferTx.wait();
        }
        this.supply = PARTICIPANTS_NUM * this.fairAlloc;

        const KtlOwnershipToken = await ethers.getContractFactory('KTLOwnership');
        this.ktlOwnershipToken = await KtlOwnershipToken.deploy(NAME, SYMBOL, TOKEN_URI);
        await this.ktlOwnershipToken.deployed();

        const ownershipTokenAddress = this.ktlOwnershipToken.address;

        const erc721ContractWithSigner = this.ktlOwnershipToken.connect(this.ownerSigner);
        const mintTx = await erc721ContractWithSigner.mint(this.user);
        await mintTx.wait();

        const ERCVaultFactory = await ethers.getContractFactory('OfferableERC721VaultFactory');
        this.ercVaultFactory = await ERCVaultFactory.deploy();
        await this.ercVaultFactory.deployed();
        const tokenVaultFactoryAddress = this.ercVaultFactory.address;

        const erc721RecipientSigner = this.ktlOwnershipToken.connect(this.projectFundRaisingSigner);
        let approveTx = await erc721RecipientSigner.approve(tokenVaultFactoryAddress, 1);
        await approveTx.wait();

        this.factoryWithSigner = this.ercVaultFactory.connect(this.ownerSigner);

        const tx = await this.factoryWithSigner.mint(ownershipTokenAddress, this.user, this.user,
            this.supply, LIST_PRICE, LISTING_PERIOD, NAME, SYMBOL, this.funderAddresses, this.allocations);
        await tx.wait();
        this.offeringAddress = await this.factoryWithSigner.getVault(0);
        console.log("Offering contract created ", this.offeringAddress);
        const OfferingVault = await ethers.getContractFactory('OfferableERC721TokenVault');
        this.offeringVault = await OfferingVault.attach(this.offeringAddress);
        this.ownerWithOffering = this.offeringVault.connect(this.projectFundRaisingSigner);
        this.nonownerWithOffering = this.offeringVault.connect(this.distributor);
        this.participantSigner = this.offeringVault.connect(this.offeringParticipants[0]);

        for (let i = 0; i < this.offeringParticipants.length; i++) {
            participantWallet = this.offeringParticipants[i];
            usdcSigner = this.usdcMock.connect(participantWallet);
            usdcApproveTx = await usdcSigner.approve(this.offeringVault.address, DOLLAR_DISTRIBUTE_AMOUNT);
            await usdcApproveTx.wait();
        }

    });

    it('Cannot be started by non-owner', async function () {
        await expectRevert(this.nonownerWithOffering.start(), 'Sender is not the project owner.');
    });

    it('Cannot make a bid on not started offering', async function() {
        await expectRevert(this.participantSigner.bid(Math.floor(this.fairAlloc / 2), 1000),
            'Offering is not live');
    });

    it('Can be started by the owner', async function() {
        const startTx = await this.ownerWithOffering.start();
        await startTx.wait();
        expect(await this.ownerWithOffering.getOfferingState()).to.equal(1);
    })

    it('Cannot bid if not among funders', async function() {
        await expectRevert(this.nonownerWithOffering.bid(Math.floor(this.fairAlloc / 2), 1000),
            'Address is not allowed to participate in the offering.');
    });

    it('Cannot bid more than allocation', async function () {
        await expectRevert(this.participantSigner.bid(this.fairAlloc * 2, 1000),
            'Bid is more than allocated for this address.');
    });

    it('Cannot buy more by paying cheaper', async function() {
       await expectRevert(this.participantSigner.bid(Math.floor(this.fairAlloc / 2), 10),
           'Funds sent for bid is less than the total capital required to buy the amount.');
    });

    it('Cannot make a bid with 0 amount', async function() {
        await expectRevert(this.participantSigner.bid(0, 1000),
            'Bid amount cannot be zero.');
    });

    it('Cannot make a bid by paying 0', async function() {
        await expectRevert(this.participantSigner.bid(Math.floor(this.fairAlloc / 2), 0),
            'Funds sent cannot be zero.');
    });

    it('Can make a legit bid', async function() {
        const participantWallet = this.offeringParticipants[0]
        const participantAddress = this.offeringParticipants[0].address;
        const fundsToSend = BUY_AMOUNT * LIST_PRICE;
        let usdcSigner = this.usdcMock.connect(participantWallet);
        let balance = await usdcSigner.balanceOf(participantAddress);
        const tx = await this.participantSigner.bid(BUY_AMOUNT, fundsToSend);
        await tx.wait();
        expect((await this.participantSigner.getRemainingAllocation(participantAddress))
            .toString()).to.equal((this.fairAlloc - BUY_AMOUNT).toString());
        expect((await this.participantSigner.getFractionalBalance(
            participantAddress)).toString()).to.equal(BUY_AMOUNT.toString());
        expect((await usdcSigner.balanceOf(participantAddress)).toString()).to.equal(
            (balance - fundsToSend).toString());
    });

    it('Can make a legit bid again without finishing the allocation', async function() {
        const participantWallet = this.offeringParticipants[0]
        const participantAddress = this.offeringParticipants[0].address;
        const fundsToSend = BUY_AMOUNT * LIST_PRICE;
        const TOTAL_AMOUNT_TO_BE_BOUGHT = 2 * BUY_AMOUNT;
        let usdcSigner = this.usdcMock.connect(participantWallet);
        let balance = await usdcSigner.balanceOf(participantAddress);
        const tx = await this.participantSigner.bid(BUY_AMOUNT, fundsToSend);
        await tx.wait();
        expect((await this.participantSigner.getRemainingAllocation(
            participantAddress)).toString()).to.equal((this.fairAlloc -
            TOTAL_AMOUNT_TO_BE_BOUGHT).toString());
        expect((await this.participantSigner.getFractionalBalance(
            participantAddress)).toString()).to.equal(TOTAL_AMOUNT_TO_BE_BOUGHT.toString());
        expect((await usdcSigner.balanceOf(participantAddress)).toString()).to.equal(
            (balance - fundsToSend).toString());
    });

    it('Cant buy more than allocated after successful bids', async function() {
        const fundsToSend = BUY_AMOUNT * LIST_PRICE;
        await expectRevert(this.participantSigner.bid(this.fairAlloc - BUY_AMOUNT, fundsToSend),
            'Bid is more than allocated for this address.');
    });

    it('Non-owner cannot pause', async function() {
        await expectRevert(this.participantSigner.pause(),
            'Sender is not the project owner.');
    });

    it('Owner can pause', async function() {
        const tx = await this.ownerWithOffering.pause();
        await tx.wait();
        expect((await this.participantSigner.paused())).is.true;
    });

    it('Cant buy when paused', async function() {
        const fundsToSend = BUY_AMOUNT * LIST_PRICE;
        await expectRevert(this.participantSigner.bid(BUY_AMOUNT, fundsToSend),
            'The bid is paused.');
    });

    it('Non-owner cannot unpause when paused', async function() {
        await expectRevert(this.participantSigner.unpause(),
            'Sender is not the project owner.');
    });

    it('Owner can unpause', async function() {
        const tx = await this.ownerWithOffering.unpause();
        await tx.wait();
        expect((await this.participantSigner.paused())).is.false;
    });

    it('Bidding finishes when allocations are all bought', async function() {
        let amountToBid, participant, participantSigner, tx, fundsToSend, participantAddress;
        for (let i = 0; i < this.offeringParticipants.length; i++) {
            participant = this.offeringParticipants[i];
            participantSigner = this.offeringVault.connect(participant);
            participantAddress = participant.address;
            amountToBid = parseInt((await participantSigner.getRemainingAllocation(participantAddress)).toString());
            fundsToSend = amountToBid * LIST_PRICE;
            let usdcSigner = this.usdcMock.connect(participant);
            let balance = await usdcSigner.balanceOf(participantAddress);
            tx = await participantSigner.bid(amountToBid, fundsToSend);
            await tx.wait();
            expect((await participantSigner.getRemainingAllocation(participantAddress))
                .toString()).to.equal("0");
            expect((await participantSigner.getFractionalBalance(participantAddress)).toString()).to.equal(
                this.fairAlloc.toString());
            expect((await usdcSigner.balanceOf(participantAddress)).toString()).to.equal(
                (balance - fundsToSend).toString());
        }
        expect((await participantSigner.getOfferingState()).toString()).to.equal("2");
    });

    it('Cannot bid on ended offering', async function() {
        let fundsToSend = BUY_AMOUNT * LIST_PRICE;
        await expectRevert(this.participantSigner.bid(BUY_AMOUNT, fundsToSend),
            'Offering is not live.');
    });



});
