import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying with account:", deployer.address);

  const GasStation = await ethers.getContractFactory("OttoGasStation");
  const gasStation = await GasStation.deploy(deployer.address);

  await gasStation.waitForDeployment();

  const deployedAddress = await gasStation.getAddress();

  console.log("OttoGasStation deployed at:", deployedAddress);
}

main().catch(console.error);