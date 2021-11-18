
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');


const NAME = "KTLO Journey Starting";
const SYMBOL = "KTLOM";
const TOKEN_URI = "HERE";
const LIST_PRICE = 5;
const PARTICIPANTS_NUM = 100;
const DOLLAR_DISTRIBUTE_AMOUNT = 100000;


describe('OfferableERC721TokenVault', function () {

    before(async function () {
        const accounts = await ethers.provider.listAccounts();
        this.owner = accounts[0];
        this.user = accounts[2];
        this.user2 = accounts[3];
        this.projectFundRaisingSigner = await ethers.getSigner(this.user);
        this.ownerSigner = await ethers.getSigner(this.owner);
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

        const usdcSigner = this.usdcMock.connect(this.distributor);
        let usdcTransferTx;


        this.fairAlloc = Math.floor(this.supply / PARTICIPANTS_NUM);

        for (let i = 0; i < PARTICIPANTS_NUM; i++) {
            participantWallet = ethers.Wallet.createRandom();
            participantAddress = participantWallet.getAddress();
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
        console.log("USDCs distributed");
        this.supply = PARTICIPANTS_NUM * this.fairAlloc;

        const KtlOwnershipToken = await ethers.getContractFactory('KTLOwnership');
        this.ktlOwnershipToken = await KtlOwnershipToken.deploy(NAME, SYMBOL, TOKEN_URI);
        await this.ktlOwnershipToken.deployed();

        const erc721ContractWithSigner = this.ktlOwnershipToken.connect(this.ownerSigner);
        const mintTx = await this.ktlOwnershipToken.mint(this.user);
        await mintTx.wait();

        console.log("Ownership token minted");

        const ERCVaultFactory = await ethers.getContractFactory('OfferableERC721VaultFactory');
        this.ercVaultFactory = await ERCVaultFactory.deploy();
        await this.ercVaultFactory.deployed();

        const tokenVaultFactoryAddress = this.ercVaultFactory.address;

        const approveTx = await erc721ContractWithSigner.setApprovalForAll(tokenVaultFactoryAddress, true);
        await approveTx.wait();

        console.log('Approval given to factory');

        this.contractWithSigner = this.ercVaultFactory.connect(this.ownerSigner);

        const tx = await this.contractWithSigner.mint(this.ktlOwnershipToken.address, this.user, this.owner,
            this.supply, LIST_PRICE, NAME, SYMBOL, this.funderAddresses, this.allocations);
        await tx.wait();
        console.log("Offering contract created");

        this.offeringAddress = await this.contractWithSigner.getVault(0);
        const OfferingVault = await ethers.getContractFactory('OfferableERC721TokenVault');
        this.offeringVault = await OfferingVault.attach(this.offeringAddress);
        this.ownerSigner = this.offeringVault.connect(this.owner);
        this.nonOwnerSigner = this.offeringVault.connect(this.distributor);
        this.participantSigner = this.offeringVault.connect(this.offeringParticipants[0]);

    });

    it('Cannot be started by non-owner', async function () {
        await expectRevert(this.nonOwnerSigner.start(), 'Sender is not the project owner.');
    });

    it('Cannot make a bid on not started offering', async function() {
        await expectRevert(this.participantSigner.bid(Math.floor(this.fairAlloc / 2), {value: 1000}),
            'Offering is not live');
    });

    it('Can be started by the owner', async function() {
        const startTx = await this.ownerSigner.start();
        await startTx.wait();
        expect(await this.ownerSigner.getOfferingState()).to.equal(1);
    })

    it('Cannot bid if not among funders', async function() {
        await expectRevert(this.nonOwnerSigner.bid(100, {value: 1000}),
            'Address is not allowed to participate in the offering.');
    });

    it('Cannot bid more than allocation', async function () {
        await expectRevert(this.participantSigner.bid(this.fairAlloc * 2, {value: 1000}),
            'Bid is more than allocated for this address.');
    });

    it('Cannot buy more by paying cheaper', async function() {
       await expectRevert(this.participantSigner.bid(Math.floor(this.fairAlloc / 2), {value: 10}),
           'Funds sent for bid is less than the total capital required to buy the amount.');
    });

    it('Cannot make a bid with 0 amount', async function() {
        await expectRevert(this.participantSigner.bid(0, {value: 1000}),
            'Bid amount cannot be zero.');
    });

    it('Cannot make a bid by paying 0', async function() {
        await expectRevert(this.participantSigner.bid(Math.floor(this.fairAlloc / 2), {value: 0}),
            'Funds sent cannot be zero.');
    });

    it('Can make a legit bid', async function() {
        const amountToBuy = Math.floor(this.fairAlloc / 2);
        const tx = await this.participantSigner.bid(amountToBuy, {value: 500});
        await tx.wait();
        expect((await this.particiapantSigner.getRemainingAllocation(
            this.offeringParticipants[0])).toString()).to.equal((this.fairAlloc - amountToBuy).toString());
    });

    it('Can make a legit bid again without finishing the allocation', async function() {
        const amountToBuy = Math.floor(this.fairAlloc / 4);
        const previouslyBoughtAmount = Math.floor(this.fairAlloc / 2);
        const tx = await this.participantSigner.bid(amountToBuy, {value: 250});
        await tx.wait();
        expect((await this.participantSigner.getRemainingAllocation(
            this.offeringParticipants[0])).toString()).to.equal((this.fairAlloc - (
                amountToBuy + previouslyBoughtAmount)).toString());
    });

    it('Cant buy more than allocated after successful bids', async function() {
        const amountToBuy = Math.floor(this.fairAlloc / 2);
        await expectRevert(this.participantSigner.bid(amountToBuy, {value: 1000}),
            'Bid is more than allocated for this address.');
    });

    it('Non-owner cannot pause', async function() {
        await expectRevert(this.participantSigner.pause(),
            'Sender is not the project owner.');
    });

    it('Owner can pause', async function() {
        const tx = await this.ownerSigner.pause();
        await tx.wait();
        expect((await this.participantSigner.paused())).is.true;
    });

    it('Cant buy when paused', async function() {
        const amountToBuy = Math.floor(this.fairAlloc / 8);
        await expectRevert(this.participantSigner.bid(amountToBuy, {value: 1000}),
            'The bid is paused.');
    });

    it('Non-owner cannot unpause when paused', async function() {
        await expectRevert(this.participantSigner.unpause(),
            'Sender is not the project owner.');
    });

    it('Owner can unpause', async function() {
        const tx = await this.ownerSigner.unpause();
        await tx.wait();
        expect((await this.participantSigner.paused())).is.false;
    });

    it('Bidding finishes when allocations are all bought', async function() {
        let amountToBid, participantSigner, tx;
        for (let participant in this.offeringParticipants) {
            participantSigner = this.offeringVault.connect(participant);
            amountToBid = await participantSigner.getRemainingAllocation(participant.address);
            tx = await participantSigner.bid(amountToBid, {value: 250});
            await tx.wait();
        }
        expect(await participantSigner.getOfferingState()).to.equal(2);
    });

    it('Cannot bid on ended offering', async function() {
        const amountToBuy = Math.floor(this.fairAlloc / 2);
        await expectRevert(this.participantSigner.bid(amountToBuy, {value: 500}),
            'Offering is not live.');
    });



});
