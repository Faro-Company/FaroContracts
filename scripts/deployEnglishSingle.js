const address = require("ethers-utils/address");
const { hre } = require("hardhat");
const { ethers } = require("hardhat");

const main = async () => {
  const accounts = await ethers.getSigners();

  const EngAuctSingle = await ethers.getContractFactory("FaroEnglishAuctionSingle");
  const EngAuctFactory = await ethers.getContractFactory("FaroEnglishAuctionFactory");

  const single = await EngAuctSingle.deploy();
  const txReceiptSingle = await single.deployTransaction.wait();
  console.log(`FaroEnglishAuctionSingle is deployed at ${single.address}`);

  const factory = await EngAuctFactory.deploy();
  const txReceiptFactory = await factory.deployTransaction.wait();
  console.log(`FaroEnglishAuctionFactory is deployed at ${factory.address} \n`);

  nf = new Intl.NumberFormat("en-US");
  console.log(`Gas used for transaction of Eng. Auction Single: ${nf.format(txReceiptSingle.gasUsed.toNumber())}`);
  console.log(`Gas used for transaction of Eng. Auction Factory: ${nf.format(txReceiptFactory.gasUsed.toNumber())}\n`);

  // mint some NFTs
  const FaroNFT = await ethers.getContractFactory("FaroNFT");
  const faroNFT = await FaroNFT.deploy("xxx", "xxx", "xxx", 1);
  await faroNFT.mint(accounts[0].address, 1);
  await faroNFT.mint(accounts[0].address, 2);
  await faroNFT.approve(single.address, 1);
  await faroNFT.approve(factory.address, 2);

  // create auctions for 2 minted NFTs
  let tx;
  let txReceipt;

  tx = await single.createAuction(faroNFT.address, 1, 100000, 100, 100);
  txReceipt = await tx.wait();
  console.log(`Gas used for creating Auction with Eng. Auction Single: ${nf.format(txReceipt.gasUsed.toNumber())}`);

  tx = await factory.createAuction(100, 100000, faroNFT.address, 2, 100);
  txReceipt = await tx.wait();
  console.log(`Gas used for creating Auction with Eng. Auction Factory: ${nf.format(txReceipt.gasUsed.toNumber())}\n`);

  const addrAuctionFromFact = await factory.getLastAuction();
  const auctionFromFactory = await ethers.getContractAt("FaroEnglishAuction", addrAuctionFromFact);

  tx = await single.startAuction(faroNFT.address, 1);
  txReceipt = await tx.wait();
  console.log(`Gas used for starting Auction with Eng. Auction Single: ${nf.format(txReceipt.gasUsed.toNumber())}`);

  tx = await auctionFromFactory.start();
  txReceipt = await tx.wait();
  console.log(`Gas used for starting Auction with Eng. Auction Factory: ${nf.format(txReceipt.gasUsed.toNumber())}\n`);

  tx = await single.attach(accounts[1].address).bid(faroNFT.address, 2, { value: 200 });
  txReceipt = await tx.wait();
  console.log(`Gas used for bidding in Auction with Eng. Auction Single: ${nf.format(txReceipt.gasUsed.toNumber())}`);

  tx = await auctionFromFactory.attach(accounts[1].address).bid({ value: 200 });
  txReceipt = await tx.wait();
  console.log(`Gas used for bidding in Auction with Eng. Auction Factory: ${nf.format(txReceipt.gasUsed.toNumber())}\n`);
};

main().then();
