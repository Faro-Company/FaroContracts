const { hre } = require("hardhat");
const { ethers } = require("hardhat");

const main = async () => {
  const signer = await ethers.getSigner();

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
  await faroNFT.mint(signer.address, 1);
  await faroNFT.mint(signer.address, 2);
  await faroNFT.approve(single.address, 1);
  await faroNFT.approve(factory.address, 2);

  // create auctions for 2 minted NFTs
  let tx;
  let txReceipt;

  tx = await single.createAuction(faroNFT.address, 1, 100, 100, 100);
  txReceipt = await tx.wait();
  console.log(`Gas used for creating Auction with Eng. Auction Single: ${nf.format(txReceipt.gasUsed.toNumber())}`);

  tx = await factory.createAuction(100, 100, faroNFT.address, 2, 100);
  txReceipt = await tx.wait();
  console.log(`Gas used for creating Auction with Eng. Auction Factory: ${nf.format(txReceipt.gasUsed.toNumber())}`);
};

main().then();
