import { expect } from "chai";
import { ethers } from "hardhat";

describe("OttoGasStation", function () {
  let owner: any;
  let executor: any;
  let user: any;
  let sponsor: any;
  let gasStation: any;
  let token: any;

  const workspaceId = ethers.id("workspace-1");

  beforeEach(async () => {
    [owner, executor, user, sponsor] = await ethers.getSigners();

    // Deploy GasStation
    const GasStation = await ethers.getContractFactory("OttoGasStation");
    gasStation = await GasStation.deploy(owner.address);
    await gasStation.waitForDeployment();

    // Deploy Mock ERC20
    const Token = await ethers.getContractFactory("MockERC20");
    token = await Token.deploy();
    await token.waitForDeployment();

    // Approve
    await token
      .connect(owner)
      .approve(gasStation.target, ethers.parseEther("1000000"));

    // Set executor
    await gasStation.connect(owner).setExecutor(executor.address, true);
  });

  /*//////////////////////////////////////////////////////////////
                          SPONSOR FLOW
  //////////////////////////////////////////////////////////////*/

  it("accepts ETH sponsor deposit", async () => {
    await expect(
      sponsor.sendTransaction({
        to: gasStation.target,
        value: ethers.parseEther("1"),
      })
    )
      .to.emit(gasStation, "SponsorDeposit")
      .withArgs(sponsor.address, ethers.parseEther("1"));

    const balance = await ethers.provider.getBalance(gasStation.target);
    expect(balance).to.equal(ethers.parseEther("1"));
  });

  it("allows owner to withdraw sponsored ETH", async () => {
    await sponsor.sendTransaction({
      to: gasStation.target,
      value: ethers.parseEther("1"),
    });

    await expect(() =>
      gasStation
        .connect(owner)
        .withdrawETH(owner.address, ethers.parseEther("1"))
    ).to.changeEtherBalances(
      [gasStation, owner],
      [ethers.parseEther("-1"), ethers.parseEther("1")]
    );
  });

  /*//////////////////////////////////////////////////////////////
                        MULTISEND CORE
  //////////////////////////////////////////////////////////////*/

  it("multisends tokens successfully", async () => {
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
  });

  it("emits TokenSent and SponsoredExecution events", async () => {
    const recipients = [user.address];
    const amounts = [ethers.parseEther("5")];

    const tx = gasStation.connect(executor).multisendERC20(
      token.target,
      owner.address,
      recipients,
      amounts,
      workspaceId
    );

    await expect(tx)
      .to.emit(gasStation, "TokenSent")
      .withArgs(
        executor.address,
        token.target,
        owner.address,
        user.address,
        ethers.parseEther("5"),
        workspaceId
      );

    await expect(tx)
      .to.emit(gasStation, "SponsoredExecution")
      .withArgs(
        executor.address,
        gasStation.target,
        1,
        workspaceId
      );
  });

  /*//////////////////////////////////////////////////////////////
                         SECURITY
  //////////////////////////////////////////////////////////////*/

  it("reverts if caller is not executor", async () => {
    await expect(
      gasStation.connect(user).multisendERC20(
        token.target,
        owner.address,
        [user.address],
        [ethers.parseEther("1")],
        workspaceId
      )
    ).to.be.revertedWithCustomError(gasStation, "NotAuthorized");
  });

  it("reverts if batch is too large", async () => {
    const recipients = Array(101).fill(user.address);
    const amounts = recipients.map(() => ethers.parseEther("1"));

    await expect(
      gasStation.connect(executor).multisendERC20(
        token.target,
        owner.address,
        recipients,
        amounts,
        workspaceId
      )
    ).to.be.revertedWithCustomError(gasStation, "BatchTooLarge");
  });

  it("reverts when paused", async () => {
    await gasStation.connect(owner).setPaused(true);

    await expect(
      gasStation.connect(executor).multisendERC20(
        token.target,
        owner.address,
        [user.address],
        [ethers.parseEther("1")],
        workspaceId
      )
    ).to.be.revertedWithCustomError(gasStation, "Paused");
  });

  /*//////////////////////////////////////////////////////////////
                           FEE LOGIC
  //////////////////////////////////////////////////////////////*/

  it("charges infra fee when feeBps is enabled", async () => {
    await gasStation.connect(owner).setFeeBps(100); // 1%

    const recipients = [user.address];
    const amounts = [ethers.parseEther("100")];

    const ownerBalanceBefore = await token.balanceOf(owner.address);

    await gasStation.connect(executor).multisendERC20(
      token.target,
      owner.address,
      recipients,
      amounts,
      workspaceId
    );

    const ownerBalanceAfter = await token.balanceOf(owner.address);

    expect(ownerBalanceAfter).to.equal(
      ownerBalanceBefore - ethers.parseEther("100")
    );
  });
});