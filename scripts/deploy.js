const hre = require("hardhat");
const { ethers } = require("hardhat");

const TokenAddress = {
    1: "",
    5: "0x1380DE70EB788b210a45f6823adB95042177c304",
};

const RewardAddress = {
    1: "",
    5: "0xFe6B30c327bC0eBa6C59744C0e2D3f41a6B7482E",
};

const AuctionAddress = {
    1: "",
    5: "0x4e9e83FEB836CA7Fa59397AC94c45A306C58f9Fb",
};

async function main() {
    const { chainId } = await ethers.provider.getNetwork();
    if(chainId == 5) {
        await DeployTestToken();
    }

    await DeployAuction(chainId);

    console.log("Done");
}

async function DeployAuction(chainId) {
    var address = AuctionAddress[chainId];
    if (address != "") {
        console.log(`Auction already deployed at ${address}`);
        return;
    }

    const tokenAddress = TokenAddress[chainId];
    const rewardAddress = RewardAddress[chainId];
    const endTimeStamp = 1676500493;

    const Auction = await ethers.getContractFactory("Auction");
    const auction = await Auction.deploy(tokenAddress, rewardAddress, endTimeStamp);

    await auction.deployed();

    AuctionAddress[chainId] = auction.address;
    console.log(`Auction deployed to ${auction.address}`);

    console.log("Sleeping before verify...");
    await sleep(120000);

    await hre.run("verify:verify", {
        address: auction.address,
        constructorArguments: [tokenAddress, rewardAddress, endTimeStamp],
    });
}

async function DeployTestToken() {
    const chainId = 5;
    var address = TokenAddress[chainId];
    if (address != "") {
        console.log(`Token already deployed at ${address}`);
        return;
    }

    const Token = await ethers.getContractFactory("Token");
    const token = await Token.deploy();

    await token.deployed();

    TokenAddress[chainId] = token.address;
    console.log(`Token deployed to ${token.address}`);

    console.log("Sleeping before verify...");
    await sleep(120000);

    await hre.run("verify:verify", {
        address: token.address,
        constructorArguments: [],
    });
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
