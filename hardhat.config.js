require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

const {
  ALCHEMY_KEY,
  ALCHEMY_GOERLI_KEY,
  GOERLI_KEY,
  MAINNET_KEY,
  ETHERSCAN_API_KEY,
} = process.env;

module.exports = {
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 500,
      },
    },
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    goerli: {
      url: `https://eth-goerli.alchemyapi.io/v2/${ALCHEMY_GOERLI_KEY}`,
      accounts: [`0x${GOERLI_KEY}`],
      gas: 2100000,
      gasPrice: 8000000000,
    },
    ethereum: {
      chainId: 1,
      url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_KEY}`,
      accounts: [`0x${MAINNET_KEY}`],
    },
  },
  etherscan: {
    apiKey: `${ETHERSCAN_API_KEY}`,
  },
};
