import { expect } from "chai";
import { ethers } from "hardhat";

describe("OttoGasStation", function () {
  let owner: any;
  let executor: any;
  let user: any;
  let gasStation: any;
  let token: any;

  const workspaceId = ethers.id("workspace-1");

  beforeEach(async () => {
    [owner, executor, user] = await ethers.getSigners();

    const GasStation = await ethers.getContractFactory("OttoGasStation");
    gasStation = await GasStation.deploy(owner.address);
    await gasStation.waitForDeployment();

    const Token = await ethers.getContractFactory("MockERC20");
    token = await Token.deploy();
    await token.waitForDeployment();

    await gasStation.connect(owner).setExecutor(executor.address, true);

    await token.connect(owner).approve(
      gasStation.target,
      ethers.parseEther("1000000")
    );
  });

  it("multisends tokens and accounts volume", async () => {
    const recipients = [user.address];
    const amounts = [ethers.parseEther("10")];

    await gasStation.connect(executor).multisendERC20(
      token.target,
      owner.address,
      recipients,
      amounts,
      workspaceId
    );

    expect(await token.balanceOf(user.address)).to.equal(
      ethers.parseEther("10")
    );

    expect(await gasStation.workspaceVolume(workspaceId)).to.equal(
      ethers.parseEther("10")
    );
  });

  
});
