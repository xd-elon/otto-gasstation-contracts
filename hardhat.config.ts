import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    sepolia: {
      url: "https://bitcoin-testnet.g.alchemy.com/v2/Tv-qakXm-fSDnlmy9GohZwY7ZLSgmx0U",
      accounts: ["0xPRIVATE_KEY"]
    },
  }
};

export default config;
